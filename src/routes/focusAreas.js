const express = require('express');
const router = express.Router();
const db = require('../database');

// List all focus areas
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT fa.*, COUNT(c.id) as challenge_count
    FROM focus_areas fa
    LEFT JOIN challenges c ON c.focus_area_id = fa.id
    GROUP BY fa.id
    ORDER BY fa.created_at DESC
  `).all();
  res.json(rows);
});

// Get one focus area
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM focus_areas WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Create focus area
router.post('/', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const result = db.prepare(
    'INSERT INTO focus_areas (name, description) VALUES (?, ?)'
  ).run(name.trim(), description.trim());
  const row = db.prepare('SELECT * FROM focus_areas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// Update focus area
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  const existing = db.prepare('SELECT * FROM focus_areas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    'UPDATE focus_areas SET name = ?, description = ? WHERE id = ?'
  ).run(name?.trim() ?? existing.name, description?.trim() ?? existing.description, req.params.id);
  res.json(db.prepare('SELECT * FROM focus_areas WHERE id = ?').get(req.params.id));
});

// Delete focus area
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM focus_areas WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

// List challenges under a focus area
router.get('/:id/challenges', (req, res) => {
  const fa = db.prepare('SELECT id FROM focus_areas WHERE id = ?').get(req.params.id);
  if (!fa) return res.status(404).json({ error: 'Focus area not found' });
  const rows = db.prepare(`
    SELECT c.*, COUNT(i.id) as idea_count
    FROM challenges c
    LEFT JOIN ideas i ON i.challenge_id = c.id
    WHERE c.focus_area_id = ?
    GROUP BY c.id
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(rows);
});

// Create challenge under a focus area
router.post('/:id/challenges', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const fa = db.prepare('SELECT id FROM focus_areas WHERE id = ?').get(req.params.id);
  if (!fa) return res.status(404).json({ error: 'Focus area not found' });
  const result = db.prepare(
    'INSERT INTO challenges (focus_area_id, name, description) VALUES (?, ?, ?)'
  ).run(req.params.id, name.trim(), description.trim());
  const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

module.exports = router;
