require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/focus-areas', require('./src/routes/focusAreas'));
app.use('/api/challenges', require('./src/routes/challenges'));
app.use('/api/ideas', require('./src/routes/ideas'));
app.use('/api/ideas', require('./src/routes/coach'));

// SPA fallback (Express 5 requires named wildcard)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Idea Platform running at http://localhost:${PORT}`);
});
