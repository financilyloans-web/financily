/* Financily frontend config — API base URL + OTP login.
 *
 * Backend OTP endpoints (server.js):
 *   POST /api/auth/send-otp   body: { id, mode }   mode: "mobile" | "email"
 *   POST /api/auth/verify-otp body: { id, code }
 *
 * In development (NODE_ENV !== production) with no SMS/email provider set, the
 * backend returns the OTP in `devOtp` so you can test without paying a provider.
 */

// Set window.__FIN_API_URL__ before this script to pin a specific backend (e.g.
// per build/preview). Otherwise: localhost → local API, everything else → the
// deployed Render backend.
var FIN_API_HOST =
  (typeof window.__FIN_API_URL__ === 'string' && window.__FIN_API_URL__)
    ? window.__FIN_API_URL__
    : location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://financily-94e0.onrender.com';   // deployed Render backend

window.FIN_API_URL = FIN_API_HOST;

window.FIN_AUTH = {
  // Request an OTP for a mobile number ("mobile") or email ("email").
  async send(id, mode) {
    const r = await fetch(FIN_API_HOST + '/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(id).trim(), mode: mode === 'email' ? 'email' : 'mobile' })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'Could not send OTP');
    // Test mode (no provider configured, non-production): backend echoes the code.
    if (j.devOtp) alert('Test mode OTP: ' + j.devOtp);
    return true;
  },
  // Verify an OTP. Never throws for a wrong/expired code — returns false so the
  // page can count the attempts itself.
  async verify(id, mode, code) {
    try {
      const r = await fetch(FIN_API_HOST + '/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: String(id).trim(), code: String(code).trim() })
      });
      const j = await r.json().catch(() => ({}));
      return j.ok === true;
    } catch (e) {
      console.warn('verify-otp failed:', e.message);
      return false;
    }
  }
};
