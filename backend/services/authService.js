const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/db');

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function register({ name, email, password }) {
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) throw new Error('Email already registered');

  const hash = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hash]
  );
  return { id: result.insertId, name, email };
}

async function login({ email, password }) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
  if (!rows.length) throw new Error('Invalid credentials');

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error('Invalid credentials');

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

// ── Forgot password flow ─────────────────────────────────────────────────────

async function sendForgotPasswordOTP(email) {
  const [users] = await db.query(
    'SELECT id FROM users WHERE email = ? AND is_active = 1',
    [email]
  );
  if (!users.length) throw new Error('No account found with that email');

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.query(
    'DELETE FROM password_resets WHERE email = ? AND type = ?',
    [email, 'password_reset']
  );
  await db.query(
    'INSERT INTO password_resets (email, otp, type, expires_at) VALUES (?, ?, ?, ?)',
    [email, otp, 'password_reset', expiresAt]
  );

  const { sendOTPEmail } = require('./emailService');
  await sendOTPEmail(email, otp, 'password_reset');
}

async function verifyForgotPasswordOTP(email, otp) {
  const [rows] = await db.query(
    `SELECT id FROM password_resets
     WHERE email = ? AND otp = ? AND type = 'password_reset'
       AND used = 0 AND expires_at > NOW()`,
    [email, otp]
  );
  if (!rows.length) throw new Error('Invalid or expired OTP');

  await db.query('UPDATE password_resets SET used = 1 WHERE id = ?', [rows[0].id]);

  const resetToken  = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await db.query(
    'INSERT INTO password_resets (email, otp, type, expires_at) VALUES (?, ?, ?, ?)',
    [email, resetToken, 'reset_token', tokenExpiry]
  );
  return resetToken;
}

async function resetPassword(email, resetToken, newPassword) {
  const [rows] = await db.query(
    `SELECT id FROM password_resets
     WHERE email = ? AND otp = ? AND type = 'reset_token'
       AND used = 0 AND expires_at > NOW()`,
    [email, resetToken]
  );
  if (!rows.length) throw new Error('Invalid or expired reset token');

  const hash = await bcrypt.hash(newPassword, 10);
  await db.query('UPDATE users SET password = ? WHERE email = ?', [hash, email]);
  await db.query('DELETE FROM password_resets WHERE email = ?', [email]);
}

// ── Registration OTP flow ────────────────────────────────────────────────────

async function sendRegisterOTP({ name, email, password }) {
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) throw new Error('Email already registered');

  const otp       = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const hash      = await bcrypt.hash(password, 10);

  await db.query(
    'DELETE FROM pending_registrations WHERE email = ?',
    [email]
  );
  await db.query(
    'INSERT INTO pending_registrations (name, email, password, otp, expires_at) VALUES (?, ?, ?, ?, ?)',
    [name, email, hash, otp, expiresAt]
  );

  const { sendOTPEmail } = require('./emailService');
  await sendOTPEmail(email, otp, 'email_verify');
}

async function verifyAndRegister({ email, otp }) {
  const [rows] = await db.query(
    `SELECT * FROM pending_registrations
     WHERE email = ? AND otp = ? AND expires_at > NOW()`,
    [email, otp]
  );
  if (!rows.length) throw new Error('Invalid or expired OTP');

  const pending = rows[0];
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) throw new Error('Email already registered');

  const [result] = await db.query(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [pending.name, pending.email, pending.password]
  );
  await db.query('DELETE FROM pending_registrations WHERE email = ?', [email]);
  return { id: result.insertId, name: pending.name, email: pending.email };
}

module.exports = {
  register,
  login,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
  sendRegisterOTP,
  verifyAndRegister,
};
