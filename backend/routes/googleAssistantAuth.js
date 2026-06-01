/**
 * Google Smart Home — OAuth 2.0 account linking endpoints.
 *
 * Flow:
 *  1. Google redirects user to GET /oauth  → we show the IoT Platform login page
 *  2. User logs in → we generate a short-lived code → redirect back to Google
 *  3. Google POSTs to /token with the code → we return the IoT Platform JWT
 *     as access_token (Google passes it back in every fulfillment request)
 */

const router  = require('express').Router();
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');

// ── In-memory code store (userId → code, expires in 5 min) ────────────────────
const pendingCodes = new Map(); // code → { userId, expiresAt }

function makeCode(userId) {
  const code = crypto.randomBytes(24).toString('hex');
  pendingCodes.set(code, { userId, expiresAt: Date.now() + 5 * 60_000 });
  // Auto-clean expired codes
  setTimeout(() => pendingCodes.delete(code), 5 * 60_000);
  return code;
}

function redeemCode(code) {
  const entry = pendingCodes.get(code);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { pendingCodes.delete(code); return null; }
  pendingCodes.delete(code);
  return entry.userId;
}

// ── GET /api/auth/google-assistant-oauth ──────────────────────────────────────
// Google redirects the user here to start account linking.
// We redirect them to the frontend /google-assistant-auth page which shows
// a login form, then POSTs credentials back and we issue the code.
router.get('/google-assistant-oauth', (req, res) => {
  const { redirect_uri, state, client_id } = req.query;

  if (client_id !== 'iot-platform-client') {
    return res.status(403).send('Invalid client_id');
  }

  // Encode Google's redirect_uri and state into our own auth page URL
  const params = new URLSearchParams({ redirect_uri, state: state || '' });
  const frontendUrl = process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/google-assistant-auth?${params}`);
});

// ── POST /api/auth/google-assistant-login ─────────────────────────────────────
// Called by our frontend auth page after the user submits their credentials.
// Returns { code } which the frontend uses to build the Google redirect URL.
router.post('/google-assistant-login', async (req, res) => {
  const { email, password, id_token, redirect_uri, state } = req.body;

  let userId;

  try {
    if (id_token) {
      // Firebase Google sign-in path
      const googleAuthService = require('../services/googleAuthService');
      const result = await googleAuthService.googleLogin(id_token);
      userId = result.user.id;
    } else if (email && password) {
      // Email/password path
      const [rows] = await db.query(
        'SELECT * FROM users WHERE email = ? AND is_active = 1', [email]
      );
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(password, rows[0].password || '');
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      userId = rows[0].id;
    } else {
      return res.status(400).json({ error: 'email+password or id_token required' });
    }
  } catch (err) {
    return res.status(401).json({ error: err.message || 'Authentication failed' });
  }

  const code        = makeCode(userId);
  const callbackUrl = new URL(redirect_uri);
  callbackUrl.searchParams.set('code',  code);
  callbackUrl.searchParams.set('state', state || '');

  res.json({ redirectUrl: callbackUrl.toString() });
});

// ── POST /api/auth/google-assistant-token ─────────────────────────────────────
// Google exchanges the authorization code for tokens.
router.post('/google-assistant-token', async (req, res) => {
  const { grant_type, code, client_id, client_secret, refresh_token } = req.body;

  // Validate client credentials
  if (client_id !== 'iot-platform-client' || client_secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  if (grant_type === 'authorization_code') {
    const userId = redeemCode(code);
    if (!userId) return res.status(400).json({ error: 'invalid_grant' });

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(400).json({ error: 'user_not_found' });

    const user = rows[0];
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role || 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Use same token as refresh token (7-day validity)
    return res.json({
      token_type:    'Bearer',
      access_token:  accessToken,
      refresh_token: accessToken,
      expires_in:    604800, // 7 days in seconds
    });
  }

  if (grant_type === 'refresh_token') {
    // Verify the existing token is still valid and re-issue
    try {
      const payload = jwt.verify(refresh_token, process.env.JWT_SECRET);
      const newToken = jwt.sign(
        { id: payload.id, email: payload.email, role: payload.role || 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        token_type:   'Bearer',
        access_token: newToken,
        expires_in:   604800,
      });
    } catch {
      return res.status(401).json({ error: 'invalid_grant' });
    }
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
});

module.exports = router;
