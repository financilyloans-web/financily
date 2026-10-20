const { readToken } = require('../utils/token');

// Blocks the request unless it carries a valid, unexpired OTP token.
module.exports = function requireVerified(req, res, next) {
  const p = readToken(req.get('x-verify-token'));
  if (!p) {
    return res.status(401).json({ ok: false, code: 'VERIFY_REQUIRED', error: 'Please verify your mobile number or email first' });
  }
  req.verified = { mode: p.m, id: p.id };   // available to the application route / saved with the lead
  next();
};
