// Tiny in-memory per-IP limiter (fine for a single Render instance).
module.exports = function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now(), ip = req.ip || 'x';
    let h = hits.get(ip);
    if (!h || h.reset < now) h = { n: 0, reset: now + windowMs };
    h.n++; hits.set(ip, h);
    if (h.n > max) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again later.' });
    next();
  };
};
