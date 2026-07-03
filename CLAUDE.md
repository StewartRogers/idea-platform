# Idea Platform

AI-powered idea management platform. Hierarchy: Focus Areas → Challenges → Ideas, each idea developed via an AI coach conversation.

## Tech Stack

- Backend: Node.js + Express 5, SQLite via `better-sqlite3`
- Auth: `express-session` + `bcryptjs` (email/password, session cookie)
- AI: `@google/generative-ai`, model `gemini-2.0-flash` (coach + extraction)
- Frontend: Vanilla HTML/CSS/JS SPA with hash routing, served from `public/`
- Database: SQLite at `data/ideas.db`

## Key Files

- `server.js` — Express entry point (port 3000), session middleware, auth gate for non-GET `/api/*`
- `src/database.js` — SQLite schema init
- `src/routes/auth.js` — register/login/logout/me
- `src/routes/focusAreas.js` — focus area CRUD + challenge list/create
- `src/routes/challenges.js` — challenge CRUD + idea list/create
- `src/routes/ideas.js` — idea CRUD + conversation save
- `src/routes/coach.js` — SSE streaming coach + `/extract` endpoint
- `public/index.html`, `public/app.js`, `public/style.css` — SPA shell/logic/styles

## Auth Model

`/api/auth/*` is always public. Every other non-GET `/api/*` request requires `req.session.userId` (401 otherwise). GET requests are unauthenticated. Existing tests in `tests/api.test.js` predate this and don't log in, so POST/PUT/DELETE tests currently fail with 401 — this is a known gap, not a regression to "fix" silently.

## Run

```bash
npm start   # http://localhost:3000
npm test    # node --test tests/api.test.js
```

## Gotchas

- Express 5 needs named wildcards: `'/{*splat}'` not `'*'`
- If `npm test` fails with `ERR_DLOPEN_FAILED` / `NODE_MODULE_VERSION` mismatch on `better-sqlite3`, the native binary was built against a different Node version — run `npm rebuild better-sqlite3`.
- `.env` needs `GEMINI_API_KEY`, `PORT`, `SESSION_SECRET` (see `.env.example`); `.env` is gitignored.
