const express = require('express');
const router = express.Router();
const db = require('../database');

// Get one idea
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT i.*, c.name as challenge_name, c.description as challenge_description,
           fa.name as focus_area_name, fa.id as focus_area_id
    FROM ideas i
    JOIN challenges c ON c.id = i.challenge_id
    JOIN focus_areas fa ON fa.id = c.focus_area_id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.conversation = JSON.parse(row.conversation || '[]');
  res.json(row);
});

// Update idea fields
router.put('/:id', (req, res) => {
  const fields = ['name', 'description', 'problem_what', 'problem_who', 'problem_scale', 'benefits'];
  const existing = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  fields.forEach(f => { updates[f] = req.body[f] ?? existing[f]; });

  db.prepare(`
    UPDATE ideas SET
      name = ?, description = ?, problem_what = ?, problem_who = ?,
      problem_scale = ?, benefits = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(updates.name, updates.description, updates.problem_what, updates.problem_who,
         updates.problem_scale, updates.benefits, req.params.id);

  const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  row.conversation = JSON.parse(row.conversation || '[]');
  res.json(row);
});

// Delete idea
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

// Save conversation history
router.put('/:id/conversation', (req, res) => {
  const { conversation } = req.body;
  if (!Array.isArray(conversation)) return res.status(400).json({ error: 'conversation must be an array' });
  const existing = db.prepare('SELECT id FROM ideas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE ideas SET conversation = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(conversation), req.params.id);
  res.json({ saved: true });
});

module.exports = router;
