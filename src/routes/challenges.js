const express = require('express');
const router = express.Router();
const db = require('../database');

// Get one challenge
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT c.*, fa.name as focus_area_name
    FROM challenges c
    JOIN focus_areas fa ON fa.id = c.focus_area_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Update challenge
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  const existing = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    'UPDATE challenges SET name = ?, description = ? WHERE id = ?'
  ).run(name?.trim() ?? existing.name, description?.trim() ?? existing.description, req.params.id);
  res.json(db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id));
});

// Delete challenge
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

// List ideas under a challenge
router.get('/:id/ideas', (req, res) => {
  const ch = db.prepare('SELECT id FROM challenges WHERE id = ?').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  const rows = db.prepare(`
    SELECT id, challenge_id, name, description, problem_what, problem_who,
           problem_scale, benefits, created_at, updated_at
    FROM ideas
    WHERE challenge_id = ?
    ORDER BY created_at ASC
  `).all(req.params.id);
  res.json(rows);
});

// Create idea under a challenge
router.post('/:id/ideas', (req, res) => {
  const ch = db.prepare('SELECT id FROM challenges WHERE id = ?').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  const result = db.prepare(
    'INSERT INTO ideas (challenge_id) VALUES (?)'
  ).run(req.params.id);
  const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

module.exports = router;
