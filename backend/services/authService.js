const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

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

module.exports = { register, login };
