require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

// Auth routes — always public
app.use('/api/auth', require('./src/routes/auth'));

// All non-GET /api requests require a session
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return next();
  if (!req.session?.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
});

app.use('/api/focus-areas', require('./src/routes/focusAreas'));
app.use('/api/challenges', require('./src/routes/challenges'));
app.use('/api/ideas', require('./src/routes/ideas'));

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Idea Platform running at http://localhost:${PORT}`));
}

module.exports = app;
