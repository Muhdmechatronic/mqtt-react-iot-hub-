/**
 * Manually reset the admin password to "admin123".
 * Run inside the Docker container:
 *   docker exec iot_backend node scripts/reset-admin.js
 *
 * Or locally (with .env configured):
 *   cd backend && node scripts/reset-admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db     = require('../config/db');

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  const [rows] = await db.query(
    "SELECT id FROM users WHERE email = 'admin@iotplatform.local'"
  );
  if (rows.length) {
    await db.query(
      "UPDATE users SET password = ? WHERE email = 'admin@iotplatform.local'",
      [hash]
    );
    console.log('Done — admin password reset to: admin123');
  } else {
    await db.query(
      "INSERT INTO users (name, email, password, role) VALUES ('Admin', 'admin@iotplatform.local', ?, 'admin')",
      [hash]
    );
    console.log('Done — admin user created with password: admin123');
  }
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
