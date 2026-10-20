// Email OTP via SMTP (nodemailer). Without SMTP_HOST it logs to the console (dev).
const nodemailer = require('nodemailer');

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: +(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',   // true for port 465
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

async function sendEmailOtp(to, code) {
  if (!process.env.SMTP_HOST) {
    console.log(`[DEV EMAIL] OTP for ${to}: ${code}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `Financily <${process.env.SMTP_USER}>`,
    to,
    subject: `${code} is your Financily verification code`,
    text: `Your Financily verification code is ${code}. It is valid for 5 minutes. Do not share it with anyone.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e3e5f0;border-radius:12px">
      <h2 style="margin:0 0 8px;color:#14123a">Financily</h2>
      <p style="color:#5b5f7a">Use this code to verify your details:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#5b3df5;margin:16px 0">${code}</p>
      <p style="color:#5b5f7a;font-size:13px">Valid for 5 minutes. If you did not request this, ignore this email. Never share this code.</p></div>`
  });
}

module.exports = { sendEmailOtp };
