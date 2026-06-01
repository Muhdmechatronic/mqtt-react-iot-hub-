const authService = require('../services/authService');

async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  try {
    const user = await authService.register({ name, email, password });
    res.status(201).json({ message: 'Registered successfully', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

// ── Forgot password ──────────────────────────────────────────────────────────

async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  try {
    await authService.sendForgotPasswordOTP(email);
    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function verifyOTP(req, res) {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
  try {
    const resetToken = await authService.verifyForgotPasswordOTP(email, otp);
    res.json({ resetToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function resetPassword(req, res) {
  const { email, resetToken, newPassword } = req.body;
  if (!email || !resetToken || !newPassword) {
    return res.status(400).json({ error: 'email, resetToken and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    await authService.resetPassword(email, resetToken, newPassword);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Registration OTP ─────────────────────────────────────────────────────────

async function sendRegisterOTP(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    await authService.sendRegisterOTP({ name, email, password });
    res.json({ message: 'Verification code sent to your email' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function verifyRegister(req, res) {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
  try {
    const user = await authService.verifyAndRegister({ email, otp });
    res.status(201).json({ message: 'Account created successfully', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  sendRegisterOTP,
  verifyRegister,
};
