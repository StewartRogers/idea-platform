require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Optional basic auth — set AUTH_PASSWORD in .env to enable
if (process.env.AUTH_PASSWORD) {
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="Idea Platform"').send('Unauthorized');
    }
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const pass = decoded.slice(decoded.indexOf(':') + 1);
    if (pass !== process.env.AUTH_PASSWORD) {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="Idea Platform"').send('Unauthorized');
    }
    next();
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/focus-areas', require('./src/routes/focusAreas'));
app.use('/api/challenges', require('./src/routes/challenges'));
app.use('/api/ideas', require('./src/routes/ideas')); // coach routes are mounted inside ideas router

// SPA fallback (Express 5 requires named wildcard)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Idea Platform running at http://localhost:${PORT}`);
  });
}

module.exports = app;
