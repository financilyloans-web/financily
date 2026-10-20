// SMS OTP. SMS_PROVIDER=msg91 for real SMS, anything else = log to server console (dev).
// India needs a DLT-registered sender ID + template; MSG91 handles the template mapping.
async function sendSmsOtp(mobile, code) {
  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();

  if (provider === 'msg91') {
    const { MSG91_AUTHKEY, MSG91_TEMPLATE_ID } = process.env;
    if (!MSG91_AUTHKEY || !MSG91_TEMPLATE_ID) throw new Error('MSG91 env vars missing');
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.search = new URLSearchParams({
      template_id: MSG91_TEMPLATE_ID,
      mobile: '91' + mobile,
      authkey: MSG91_AUTHKEY,
      otp: code,
      otp_expiry: '5'
    });
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.type !== 'success') throw new Error('MSG91: ' + (j.message || res.status));
    return;
  }

  console.log(`[DEV SMS] OTP for +91 ${mobile}: ${code}`);
}

module.exports = { sendSmsOtp };
