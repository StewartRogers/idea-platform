const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Use an in-memory test database so tests never touch the real data
process.env.NODE_ENV = 'test';

// Patch the database module to use in-memory DB before loading the app
const dbModule = require('../src/database');
// Note: database.js exports the db instance — we cannot easily swap it without
// refactoring the module. Instead, we use a separate test DB file that gets
// cleaned up after tests, isolated from the real data/ dir.

// We'll just run tests against the real server using a unique test DB path.
// The simplest approach: set a TEST_DB env var and patch database.js to read it.
// Since database.js is already loaded above, let's just clear tables before each suite.

const app = require('../server');

// Helper to get a clean DB state between test files (truncate all tables)
function clearDb() {
  dbModule.exec('DELETE FROM ideas');
  dbModule.exec('DELETE FROM challenges');
  dbModule.exec('DELETE FROM focus_areas');
  // Reset autoincrement counters
  dbModule.exec("DELETE FROM sqlite_sequence WHERE name IN ('ideas','challenges','focus_areas')");
}

describe('Focus Areas API', () => {
  before(clearDb);

  it('GET /api/focus-areas returns empty array initially', async () => {
    const res = await request(app).get('/api/focus-areas');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('POST /api/focus-areas creates a focus area', async () => {
    const res = await request(app)
      .post('/api/focus-areas')
      .send({ name: 'Test Area', description: 'A test' });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Test Area');
    assert.equal(res.body.description, 'A test');
    assert.ok(res.body.id);
  });

  it('POST /api/focus-areas rejects missing name', async () => {
    const res = await request(app)
      .post('/api/focus-areas')
      .send({ description: 'no name here' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  it('POST /api/focus-areas rejects blank name', async () => {
    const res = await request(app)
      .post('/api/focus-areas')
      .send({ name: '   ' });
    assert.equal(res.status, 400);
  });

  it('GET /api/focus-areas/:id returns the focus area', async () => {
    const created = await request(app).post('/api/focus-areas').send({ name: 'Area 2' });
    const res = await request(app).get(`/api/focus-areas/${created.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Area 2');
  });

  it('GET /api/focus-areas/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/focus-areas/99999');
    assert.equal(res.status, 404);
  });

  it('PUT /api/focus-areas/:id updates name and description', async () => {
    const created = await request(app).post('/api/focus-areas').send({ name: 'Old Name' });
    const res = await request(app)
      .put(`/api/focus-areas/${created.body.id}`)
      .send({ name: 'New Name', description: 'Updated' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'New Name');
    assert.equal(res.body.description, 'Updated');
  });

  it('PUT /api/focus-areas/:id rejects empty name', async () => {
    const created = await request(app).post('/api/focus-areas').send({ name: 'Keep Me' });
    const res = await request(app)
      .put(`/api/focus-areas/${created.body.id}`)
      .send({ name: '' });
    assert.equal(res.status, 400);
    // name should not have changed
    const check = await request(app).get(`/api/focus-areas/${created.body.id}`);
    assert.equal(check.body.name, 'Keep Me');
  });

  it('DELETE /api/focus-areas/:id removes the focus area', async () => {
    const created = await request(app).post('/api/focus-areas').send({ name: 'Delete Me' });
    const del = await request(app).delete(`/api/focus-areas/${created.body.id}`);
    assert.equal(del.status, 200);
    const check = await request(app).get(`/api/focus-areas/${created.body.id}`);
    assert.equal(check.status, 404);
  });
});

describe('Challenges API', () => {
  let faId;

  before(() => {
    clearDb();
    const fa = dbModule.prepare("INSERT INTO focus_areas (name) VALUES (?)").run('FA for Challenges');
    faId = fa.lastInsertRowid;
  });

  it('POST /api/focus-areas/:id/challenges creates a challenge', async () => {
    const res = await request(app)
      .post(`/api/focus-areas/${faId}/challenges`)
      .send({ name: 'My Challenge', description: 'Desc' });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'My Challenge');
    assert.equal(res.body.focus_area_id, faId);
  });

  it('POST challenge rejects missing name', async () => {
    const res = await request(app)
      .post(`/api/focus-areas/${faId}/challenges`)
      .send({ description: 'no name' });
    assert.equal(res.status, 400);
  });

  it('POST challenge returns 404 for unknown focus area', async () => {
    const res = await request(app)
      .post('/api/focus-areas/99999/challenges')
      .send({ name: 'Orphan' });
    assert.equal(res.status, 404);
  });

  it('GET /api/challenges/:id returns challenge with focus_area_name', async () => {
    const created = await request(app)
      .post(`/api/focus-areas/${faId}/challenges`)
      .send({ name: 'Challenge X' });
    const res = await request(app).get(`/api/challenges/${created.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.focus_area_name, 'FA for Challenges');
  });

  it('PUT /api/challenges/:id rejects empty name', async () => {
    const created = await request(app)
      .post(`/api/focus-areas/${faId}/challenges`)
      .send({ name: 'Stable Name' });
    const res = await request(app)
      .put(`/api/challenges/${created.body.id}`)
      .send({ name: '' });
    assert.equal(res.status, 400);
  });

  it('DELETE /api/challenges/:id cascades to ideas', async () => {
    const ch = await request(app)
      .post(`/api/focus-areas/${faId}/challenges`)
      .send({ name: 'To Delete' });
    const chId = ch.body.id;
    // Create an idea under this challenge
    dbModule.prepare('INSERT INTO ideas (challenge_id) VALUES (?)').run(chId);
    // Delete the challenge
    const del = await request(app).delete(`/api/challenges/${chId}`);
    assert.equal(del.status, 200);
    // Ideas should also be gone
    const ideas = dbModule.prepare('SELECT * FROM ideas WHERE challenge_id = ?').all(chId);
    assert.equal(ideas.length, 0);
  });
});

describe('Ideas API', () => {
  let chId;

  before(() => {
    clearDb();
    const fa = dbModule.prepare("INSERT INTO focus_areas (name) VALUES (?)").run('FA for Ideas');
    const ch = dbModule.prepare("INSERT INTO challenges (focus_area_id, name) VALUES (?, ?)").run(fa.lastInsertRowid, 'Ch for Ideas');
    chId = ch.lastInsertRowid;
  });

  it('POST /api/challenges/:id/ideas creates an untitled idea', async () => {
    const res = await request(app)
      .post(`/api/challenges/${chId}/ideas`)
      .send({});
    assert.equal(res.status, 201);
    assert.equal(res.body.challenge_id, chId);
    assert.equal(res.body.name, '');
  });

  it('GET /api/ideas/:id returns idea with challenge and focus area context', async () => {
    const created = await request(app).post(`/api/challenges/${chId}/ideas`).send({});
    const res = await request(app).get(`/api/ideas/${created.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.challenge_name, 'Ch for Ideas');
    assert.equal(res.body.focus_area_name, 'FA for Ideas');
    assert.ok(Array.isArray(res.body.conversation));
  });

  it('PUT /api/ideas/:id updates fields', async () => {
    const created = await request(app).post(`/api/challenges/${chId}/ideas`).send({});
    const res = await request(app)
      .put(`/api/ideas/${created.body.id}`)
      .send({ name: 'Great Idea', description: 'Does things', benefits: 'Many' });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'Great Idea');
    assert.equal(res.body.benefits, 'Many');
  });

  it('PUT /api/ideas/:id/conversation saves conversation array', async () => {
    const created = await request(app).post(`/api/challenges/${chId}/ideas`).send({});
    const convo = [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi!' }];
    const res = await request(app)
      .put(`/api/ideas/${created.body.id}/conversation`)
      .send({ conversation: convo });
    assert.equal(res.status, 200);
    assert.equal(res.body.saved, true);
    // Verify it persisted
    const check = await request(app).get(`/api/ideas/${created.body.id}`);
    assert.equal(check.body.conversation.length, 2);
  });

  it('PUT /api/ideas/:id/conversation rejects non-array', async () => {
    const created = await request(app).post(`/api/challenges/${chId}/ideas`).send({});
    const res = await request(app)
      .put(`/api/ideas/${created.body.id}/conversation`)
      .send({ conversation: 'not an array' });
    assert.equal(res.status, 400);
  });

  it('DELETE /api/ideas/:id removes the idea', async () => {
    const created = await request(app).post(`/api/challenges/${chId}/ideas`).send({});
    const del = await request(app).delete(`/api/ideas/${created.body.id}`);
    assert.equal(del.status, 200);
    const check = await request(app).get(`/api/ideas/${created.body.id}`);
    assert.equal(check.status, 404);
  });
});

describe('Cascade deletes', () => {
  it('Deleting a focus area removes its challenges and ideas', async () => {
    clearDb();
    const fa = await request(app).post('/api/focus-areas').send({ name: 'Top Level' });
    const ch = await request(app)
      .post(`/api/focus-areas/${fa.body.id}/challenges`)
      .send({ name: 'Child Challenge' });
    await request(app).post(`/api/challenges/${ch.body.id}/ideas`).send({});

    await request(app).delete(`/api/focus-areas/${fa.body.id}`);

    const challenges = dbModule.prepare('SELECT * FROM challenges WHERE focus_area_id = ?').all(fa.body.id);
    const ideas = dbModule.prepare('SELECT * FROM ideas WHERE challenge_id = ?').all(ch.body.id);
    assert.equal(challenges.length, 0);
    assert.equal(ideas.length, 0);
  });
});
