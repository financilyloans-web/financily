// Small signed token (HMAC-SHA256) issued after a successful OTP check.
// No extra dependency needed. Format: base64url(payload).signature
const crypto = require('crypto');

const secret = () => {
  const s = process.env.OTP_SECRET;
  if (!s || s.length < 16) throw new Error('OTP_SECRET missing or too short (min 16 chars)');
  return s;
};
const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

function issueToken(payload, ttlSeconds) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 }));
  return body + '.' + sign(body);
}

function readToken(token) {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const good = sign(body);
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

function hashOtp(key, code) {
  return crypto.createHmac('sha256', secret()).update(key + ':' + code).digest('hex');
}

module.exports = { issueToken, readToken, hashOtp };
