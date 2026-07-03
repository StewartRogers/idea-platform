# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Idea Platform

AI-powered idea management platform. Hierarchy: Focus Areas → Challenges → Ideas, each idea developed via an AI coach conversation.

## Tech Stack

- Backend: Node.js + Express 5, SQLite via `better-sqlite3`
- Auth: `express-session` + `bcryptjs` (email/password, session cookie)
- AI: `@google/generative-ai`, model `gemini-3.1-flash-lite-preview` (coach + extraction, see `src/routes/coach.js`)
- Frontend: Vanilla HTML/CSS/JS SPA with hash routing, served from `public/`
- Database: SQLite at `data/ideas.db`

## Key Files

- `server.js` — Express entry point (port 3000), session middleware, auth gate for non-GET `/api/*`
- `src/database.js` — SQLite schema init (`users`, `focus_areas`, `challenges`, `ideas`; cascading FKs)
- `src/routes/auth.js` — register/login/logout/me
- `src/routes/focusAreas.js` — focus area CRUD + challenge list/create
- `src/routes/challenges.js` — challenge CRUD + idea list/create
- `src/routes/ideas.js` — idea CRUD + conversation save
- `src/routes/coach.js` — SSE streaming coach + `/extract` endpoint
- `public/index.html`, `public/app.js`, `public/style.css` — SPA shell/logic/styles

## Auth Model

`/api/auth/*` is always public. Every other non-GET `/api/*` request requires `req.session.userId` (401 otherwise). GET requests are unauthenticated. Existing tests in `tests/api.test.js` predate this and don't log in, so POST/PUT/DELETE tests currently fail with 401 — this is a known gap, not a regression to "fix" silently.

## Coach Conversation Flow

An idea's entire coaching conversation is stored as a JSON array (`role`/`content` messages) in the `ideas.conversation` column — there's no separate messages table. `ideas` also carries `problem_what`/`problem_who`/`problem_scale`/`benefits` columns from a prior schema — these are legacy/unused, kept only for backward data compatibility; no route reads or writes them anymore.

- `POST /api/ideas/:id/coach` (`src/routes/coach.js`) takes `{ message }` (no `stage` — it's inferred server-side, see below), appends the user message, converts the stored history to Gemini's `user`/`model` role format, and streams the reply back token-by-token over SSE (`data: {type: 'token'|'done'|'error', ...}`). The full assistant reply is appended to `conversation` and persisted after the stream completes.
- Coaching moves through three fixed `STAGES` (`problem_statement` → `value_proposition` → `hypothesis`), each with a best-practice-shaped instruction (e.g. value proposition follows a lean-canvas template) injected into the Gemini system prompt via `buildSystemPrompt()`. `inferCurrentStage(idea)` picks the first empty field each request — there's no client-driven "next" button or stage index in the wire format anymore. `name`/`description` are not stage-coached; they're captured from the opening exchange (the coach's first message asks the user to describe their idea) and refined via extraction like the other fields.
- Conversations are capped at `MAX_MESSAGES = 100`; further coach requests on that idea return 400.
- `POST /api/ideas/:id/extract` re-reads the full conversation and asks Gemini (JSON mode, `EXTRACT_SCHEMA`) to pull structured fields (`name`, `description`, `problem_statement`, `value_proposition`, `hypothesis`) out of it, then updates the `ideas` row — only overwriting fields where extraction returned a non-empty value, so partial conversations don't blank out previously extracted data.
- `POST /api/ideas/:id/pitch` is a separate, non-streaming synthesis call (not conversation extraction) that combines `name`/`description`/`problem_statement`/`value_proposition`/`hypothesis` into a short elevator pitch and saves it to `ideas.pitch`. It's a no-op (`{ pitch: '' }`, no Gemini call) until all three coached fields are non-empty. `pitch` is excluded from `PUT /api/ideas/:id`'s field whitelist — it's a generated artifact, not hand-editable.
- Frontend (`public/app.js`) renders all four fields (problem statement, value proposition, hypothesis, pitch) as an always-on dashboard of cards that update live after every coach turn — not the old one-field-at-a-time stage-gated view. The `STAGES` array is hand-duplicated between `src/routes/coach.js` and `public/app.js` (key/label in both, `instruction` vs `placeholder` differ) since there's no shared module boundary between the server and the plain-`<script>` frontend in this stack — keep them in sync manually when changing stage content.

## Run

```bash
npm start   # http://localhost:3000
npm test    # node --test tests/api.test.js
```

## Gotchas

- Express 5 needs named wildcards: `'/{*splat}'` not `'*'`
- If `npm test` fails with `ERR_DLOPEN_FAILED` / `NODE_MODULE_VERSION` mismatch on `better-sqlite3`, the native binary was built against a different Node version — run `npm rebuild better-sqlite3`.
- `.env` needs `GEMINI_API_KEY`, `PORT`, `SESSION_SECRET` (see `.env.example`); `.env` is gitignored.
