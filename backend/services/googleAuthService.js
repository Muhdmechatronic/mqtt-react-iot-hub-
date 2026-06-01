const jwt = require('jsonwebtoken');
const db  = require('../config/db');
const jwtLib = require('jsonwebtoken');

// ─── Firebase ID token verification ──────────────────────────────────────────
// Firebase tokens are RS256 JWTs. Public certs are published by Google.
// We verify without firebase-admin — no service-account file needed.

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let _certCache   = null;
let _cacheExpiry = 0;

async function getFirebaseCerts() {
  if (_certCache && Date.now() < _cacheExpiry) return _certCache;

  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) throw new Error('Failed to fetch Firebase public certs');

  // Respect Google's Cache-Control max-age
  const cc    = res.headers.get('cache-control') || '';
  const match = cc.match(/max-age=(\d+)/);
  const ttl   = match ? parseInt(match[1]) * 1000 : 3_600_000; // default 1 h

  _certCache   = await res.json();
  _cacheExpiry = Date.now() + ttl;
  return _certCache;
}

async function verifyFirebaseToken(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not set in backend environment');

  // Decode header to get key ID
  const decoded = jwtLib.decode(idToken, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Invalid Firebase token structure');

  const certs = await getFirebaseCerts();
  const cert  = certs[decoded.header.kid];
  if (!cert) throw new Error('Firebase signing key not found — token may have expired');

  // Verify signature + standard claims
  const payload = jwtLib.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience:   projectId,
    issuer:     `https://securetoken.google.com/${projectId}`,
  });

  return payload; // { uid, email, name, picture, email_verified, ... }
}

// ─── Upsert user from Firebase payload ───────────────────────────────────────

async function googleLogin(idToken) {
  const payload = await verifyFirebaseToken(idToken);
  const { uid: googleId, email, name, picture } = payload;

  if (!email) throw new Error('Google account has no email address');

  // 1. Lookup by google_id
  let [rows] = await db.query('SELECT * FROM users WHERE google_id = ?', [googleId]);

  if (!rows.length) {
    // 2. Try to link an existing email account
    [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length) {
      await db.query(
        'UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE email = ?',
        [googleId, picture, email]
      );
      rows[0].google_id  = googleId;
      rows[0].avatar_url = rows[0].avatar_url || picture;
    } else {
      // 3. New user — auto-register (no password)
      const [result] = await db.query(
        'INSERT INTO users (name, email, google_id, avatar_url, is_active) VALUES (?, ?, ?, ?, 1)',
        [name || email.split('@')[0], email, googleId, picture]
      );
      [rows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    }
  } else {
    // Refresh avatar on every sign-in so it stays current
    await db.query('UPDATE users SET avatar_url = ? WHERE google_id = ?', [picture, googleId]);
    rows[0].avatar_url = picture;
  }

  const user = rows[0];

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  return {
    token,
    user: {
      id:     user.id,
      name:   user.name,
      email:  user.email,
      role:   user.role || 'user',
      avatar: user.avatar_url || picture,
    },
  };
}

module.exports = { googleLogin };
