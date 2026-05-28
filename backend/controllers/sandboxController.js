const db = require('../config/db');

async function list(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT id, name, created_at FROM sandbox_templates WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function save(req, res) {
  try {
    const { name, widgets } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });

    const [existing] = await db.query(
      'SELECT id FROM sandbox_templates WHERE user_id = ? AND name = ? LIMIT 1',
      [req.user.id, name.trim()]
    );

    if (existing.length) {
      await db.query(
        'UPDATE sandbox_templates SET widgets_json = ? WHERE id = ?',
        [JSON.stringify(widgets || []), existing[0].id]
      );
      return res.json({ id: existing[0].id, name: name.trim(), overwritten: true });
    }

    const [result] = await db.query(
      'INSERT INTO sandbox_templates (user_id, name, widgets_json) VALUES (?, ?, ?)',
      [req.user.id, name.trim(), JSON.stringify(widgets || [])]
    );
    res.status(201).json({ id: result.insertId, name: name.trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function load(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT id, name, widgets_json FROM sandbox_templates WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });

    let widgets = [];
    try { widgets = JSON.parse(rows[0].widgets_json || '[]'); } catch {}
    res.json({ id: rows[0].id, name: rows[0].name, widgets });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function remove(req, res) {
  try {
    await db.query(
      'DELETE FROM sandbox_templates WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { list, save, load, remove };
