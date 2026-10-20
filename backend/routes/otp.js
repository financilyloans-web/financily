const express = require('express');
const crypto = require('crypto');
const Otp = require('../models/Otp');
const rateLimit = require('../middleware/rateLimit');
const { sendSmsOtp } = require('../services/sms');
const { sendEmailOtp } = require('../services/mailer');
const { issueToken, hashOtp } = require('../utils/token');

const router = express.Router();

const OTP_TTL_MS     = 5 * 60 * 1000;
const RESEND_GAP_MS  = 30 * 1000;
const WINDOW_MS      = 60 * 60 * 1000;
const MAX_SENDS      = 5;      // per identifier per hour
const MAX_ATTEMPTS   = 3;
const TOKEN_TTL_SEC  = 2 * 60 * 60;

router.use(rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }));

function normalise(mode, id) {
  id = String(id || '').trim();
  if (mode === 'mobile') return /^[6-9]\d{9}$/.test(id) ? id : null;
  if (mode === 'email') {
    id = id.toLowerCase();
    return id.length <= 80 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(id) ? id : null;
  }
  return null;
}

router.post('/send', async (req, res) => {
  try {
    const mode = req.body.mode;
    const id = normalise(mode, req.body.id);
    if (!id) return res.status(400).json({ ok: false, error: mode === 'email' ? 'Enter a valid email address' : 'Enter a valid 10 digit mobile number' });

    const key = `${mode}:${id}`, now = Date.now();
    const existing = await Otp.findOne({ key });
    let sendCount = 1, windowStart = new Date(now);

    if (existing) {
      const wait = existing.lastSentAt.getTime() + RESEND_GAP_MS - now;
      if (wait > 0) return res.status(429).json({ ok: false, error: `Please wait ${Math.ceil(wait / 1000)}s before requesting another OTP` });
      if (existing.windowStart.getTime() + WINDOW_MS > now) {
        if (existing.sendCount >= MAX_SENDS) return res.status(429).json({ ok: false, error: 'Too many OTP requests. Please try again after an hour.' });
        sendCount = existing.sendCount + 1;
        windowStart = existing.windowStart;
      }
    }

    const code = String(crypto.randomInt(100000, 1000000));
    await Otp.findOneAndUpdate({ key }, {
      key, mode, codeHash: hashOtp(key, code),
      expiresAt: new Date(now + OTP_TTL_MS), attempts: 0,
      sendCount, windowStart, lastSentAt: new Date(now),
      purgeAt: new Date(windowStart.getTime() + WINDOW_MS + 60000)
    }, { upsert: true, setDefaultsOnInsert: true });

    try {
      await (mode === 'mobile' ? sendSmsOtp(id, code) : sendEmailOtp(id, code));
    } catch (e) {
      console.error('OTP delivery failed:', e.message);
      await Otp.deleteOne({ key });
      return res.status(502).json({ ok: false, error: 'Could not send OTP right now. Please try again.' });
    }
    res.json({ ok: true, expiresIn: OTP_TTL_MS / 1000 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const mode = req.body.mode;
    const id = normalise(mode, req.body.id);
    const code = String(req.body.code || '');
    if (!id || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'Enter the 6 digit OTP' });

    const key = `${mode}:${id}`;
    // Atomically count the attempt first, so parallel guesses can't exceed the limit.
    const doc = await Otp.findOneAndUpdate(
      { key, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } }, { new: true });
    if (!doc) return res.status(410).json({ ok: false, error: 'OTP expired or too many wrong attempts. Please request a new OTP.' });

    const a = Buffer.from(doc.codeHash), b = Buffer.from(hashOtp(key, code));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      const left = MAX_ATTEMPTS - doc.attempts;
      return res.status(400).json({ ok: false, wrong: true, attemptsLeft: left, error: left > 0 ? `Incorrect OTP. Attempts left: ${left}` : 'Too many wrong attempts. Please request a new OTP.' });
    }

    await Otp.updateOne({ key }, { $set: { expiresAt: new Date(0) } });   // single use
    res.json({ ok: true, token: issueToken({ m: mode, id }, TOKEN_TTL_SEC), expiresIn: TOKEN_TTL_SEC });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
