/**
 * PAN OCR pipeline — backend service.
 *
 * Flow:  image validation -> OCR (Google Vision -> Azure Form Recognizer ->
 *        FreeOCR) -> PAN regex validation -> extraction (PAN / full name /
 *        father name / DOB) -> optional save to MongoDB.
 *
 * Provider selection is by environment config; the first configured provider
 * is used. If none is configured the service returns a clear error so the
 * caller can fall back.
 */
const { Application } = require('../models');

/* ---------- Image validation ---------- */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'application/pdf'];

function validateImage(base64) {
  const raw = typeof base64 === 'string' && base64.includes(',')
    ? base64.slice(base64.indexOf(',') + 1) : base64;
  if (typeof raw !== 'string' || !raw) {
    throw new Error('image_base64 is required');
  }
  const buf = Buffer.from(raw, 'base64');
  if (!buf.length) throw new Error('Could not decode image');
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error('Image too large (max 6MB)');
  }
  // Content-type hint from the data URL prefix, if present.
  let mime = '';
  if (typeof base64 === 'string') {
    const mt = base64.match(/^data:([^;,]+)/);
    if (mt) mime = mt[1].toLowerCase();
  }
  if (mime && !ALLOWED_TYPES.includes(mime) && mime !== 'application/pdf') {
    throw new Error('Unsupported file type: ' + mime);
  }
  return { buf, mime };
}

/* ---------- OCR providers ---------- */

async function ocrGoogleVision(buf, mime) {
  const vision = require('@google-cloud/vision');
  const client = new vision.ImageAnnotatorClient();
  const [result] = await client.textDetection({ image: { content: buf } });
  const text = (result.textAnnotations && result.textAnnotations[0] && result.textAnnotations[0].description) || '';
  if (!text) throw new Error('Google Vision returned no text');
  return text;
}

async function ocrAzure(buf, mime) {
  const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
  const endpoint = process.env.AZURE_FORM_RECOGNIZER_ENDPOINT;
  const key = process.env.AZURE_FORM_RECOGNIZER_KEY;
  if (!endpoint || !key) throw new Error('Azure not configured');
  const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  const poller = await client.beginAnalyzeDocument('prebuilt-read', buf);
  const { content } = await poller.pollUntilDone();
  if (!content) throw new Error('Azure returned no text');
  return content;
}

async function ocrFree(base64) {
  const key = process.env.FREEOCR_API_KEY;
  if (!key) throw new Error('FreeOCR not configured');
  const raw = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const buf = Buffer.from(raw, 'base64');
  const form = new FormData();
  form.append('image', new Blob([buf]), 'document.png');
  const r = await fetch('https://freeocr.ai/api/v1/platform/ocr', {
    method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: form
  });
  if (!r.ok) throw new Error('FreeOCR ' + r.status);
  const ct = r.headers.get('content-type') || '';
  if (ct.indexOf('application/json') !== -1) {
    const j = await r.json();
    return j.text || j.recognized_text || j.markdown || JSON.stringify(j);
  }
  return r.text();
}

async function runOcr(base64, mime) {
  const raw = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const buf = Buffer.from(raw, 'base64');
  const providerOrder = ['google', 'azure', 'free'];
  const active = [];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT) active.push('google');
  if (process.env.AZURE_FORM_RECOGNIZER_ENDPOINT && process.env.AZURE_FORM_RECOGNIZER_KEY) active.push('azure');
  if (process.env.FREEOCR_API_KEY) active.push('free');

  const chosen = active[0];
  if (!chosen) throw new Error('No OCR provider configured (set Google/Azure/FreeOCR credentials)');

  const t0 = Date.now();
  let text;
  switch (chosen) {
    case 'google': text = await ocrGoogleVision(buf, mime); break;
    case 'azure': text = await ocrAzure(buf, mime); break;
    default: text = await ocrFree(base64); break;
  }
  return { text, provider: chosen, timeMs: Date.now() - t0 };
}

/* ---------- PAN validation & extraction ---------- */

const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/;

function toWords(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

function extractDob(text) {
  // Indian date formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY
  const m = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
  if (!m) return '';
  let d = m[1], mo = m[2], y = m[3];
  if (y.length === 2) y = '19' + y;
  const dd = d.padStart(2, '0'), mm = mo.padStart(2, '0');
  if (dd > 31 || mm > 12) return '';
  return `${y}-${mm}-${dd}`;
}

function extractFatherName(text) {
  const m = text.match(/Father\s*(?:'s\s*)?Name\s*:?\s*([A-Z][A-Za-z .]{2,40})/i);
  return m ? m[1].trim() : '';
}

function extractName(text) {
  // "Name : <Text>" often present on PAN card.
  let m = text.match(/Name\s*:?\s*([A-Z][A-Za-z .]{2,60})/i);
  return m ? m[1].trim() : '';
}

function parsePanText(text) {
  const up = text.toUpperCase();
  const panMatch = up.match(PAN_RE);
  const pan = panMatch ? panMatch[0] : '';

  let name = extractName(text);
  let father = extractFatherName(text);
  const dob = extractDob(text);

  if (!name && pan) {
    // Fallback heuristic: first uppercase line after the PAN block that looks
    // like a person's name (letters + spaces, not a label).
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^(name|father|mother|dob|date|address|pan|permanent|income|signature)/i.test(line)) continue;
      if (/^[A-Z][A-Za-z .]{2,40}$/.test(line) && !PAN_RE.test(line.toUpperCase())) {
        name = line; break;
      }
    }
  }

  return { pan, name, father, dob };
}

/* ---------- Main pipeline ---------- */
async function processPanImage({ image_base64, save = true }) {
  const { buf, mime } = validateImage(image_base64);

  const { text, provider, timeMs } = await runOcr(image_base64, mime);

  const extracted = parsePanText(text);

  if (!extracted.pan) {
    return {
      ok: false, stage: 'pan_regex', provider, timeMs,
      message: 'PAN number not detected clearly. Try a clearer image.',
      raw_text: text.slice(0, 2000), extracted
    };
  }

  // PAN format check (strict).
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(extracted.pan)) {
    return {
      ok: false, stage: 'pan_regex', provider, timeMs,
      message: 'PAN format invalid', raw_text: text.slice(0, 2000), extracted
    };
  }

  let saved = null;
  if (save) {
    try {
      saved = await Application.create({
        name: extracted.name || 'PAN Upload',
        mobile: '', email: '', city: '', loanType: 'Other',
        amount: 0, tenure: 0, income: 0, cibil: '', source: 'pan_upload',
        data: { text, pan: extracted.pan, father: extracted.father, dob: extracted.dob, provider },
        note: 'Uploaded via PAN OCR pipeline', status: 'new'
      });
    } catch (e) {
      console.error('panOcr save failed:', e.message);
    }
  }

  return {
    ok: true, stage: 'complete', provider, timeMs,
    pan: extracted.pan, name: extracted.name, father: extracted.father, dob: extracted.dob,
    saved: !!saved, ref: saved ? saved.ref : undefined
  };
}

module.exports = { processPanImage, validateImage, parsePanText, extractDob, extractFatherName, extractName };
