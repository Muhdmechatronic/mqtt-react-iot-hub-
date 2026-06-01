const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT  || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOTPEmail(to, otp, type) {
  const isVerify  = type === 'email_verify';
  const subject   = isVerify
    ? 'Your IoT Platform Email Verification Code'
    : 'Your IoT Platform Password Reset Code';
  const action    = isVerify ? 'verify your email' : 'reset your password';

  await transporter.sendMail({
    from: `"IoT Platform" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: `Your IoT Platform OTP to ${action} is: ${otp}\n\nThis code expires in 10 minutes. Do not share it.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:28px;
                  border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <div style="width:36px;height:36px;border-radius:8px;background:#0ea5e9;
                      display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-size:18px;">⚡</span>
          </div>
          <span style="font-size:18px;font-weight:700;color:#0f172a;">IoT Platform</span>
        </div>
        <p style="color:#475569;margin-bottom:6px;">
          Your one-time code to <strong>${action}</strong>:
        </p>
        <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#0f172a;
                    background:#fff;border:2px solid #e2e8f0;border-radius:10px;
                    padding:20px 0;text-align:center;margin:16px 0;">
          ${otp}
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-top:12px;">
          This code expires in <strong>10 minutes</strong>.<br>
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

module.exports = { sendOTPEmail };
