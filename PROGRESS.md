# ResearchForge AI — Progress / Continuity Log

> **Next session: read this file first and pick up exactly where we left off.**
> Update this file at the end of every session and after each phase completes.

## Standing rules

- The API key lives only in `server/.env` as `MODEL_API_KEY`. Never put it in this file, in chat, in front-end code, or in any committed file.
- The AI coaches student judgment. It never writes the model answer.
- Every feedback message must quote a passage that exists word for word in the article. The server verifies each quote before it is shown.
- This is research appraisal training for students. It is not medical advice.

## Current state — Phase 1 COMPLETE (2026-10-26)

- Commit `557f73b` on `main`, pushed to `https://github.com/wendymarquette68/Research_Forge`.
- Scaffold built: React + TypeScript + Tailwind front end (`client/`), Node.js + Express back end (`server/`).
- One small test call to the Meta Model API passed — see Verified below.

## Verified

- Express back end (`server/src/index.js`) with the key read server-only in `server/src/modelClient.js`. The browser calls `/api/*`; it never sees the key.
- Model: `muse-spark-1.3`, standard mode (plain model ID, not the `-contributor` tier), via `https://api.meta.ai/v1/chat/completions`.
- Endpoints: `GET /api/health` (reports model, base URL, `hasKey` boolean only) and `POST /api/test-call` (one small connectivity call).
- React + TypeScript + Tailwind (Vite) front end in `client/`. Build passes (`tsc -b && vite build`). Front-end source and built bundle contain no `MODEL_API_KEY` and no `api.meta.ai` string.
- `server/.env` is gitignored (matched by `.env` in the root `.gitignore`), was not staged, and the key value does not appear in any commit. Template is `server/.env.example` with an empty value.
- Test call passed both ways:
  - CLI: `npm run test-call` → `TEST CALL OK`, reply "ResearchForge connected".
  - Browser path: `POST /api/test-call` → `{"ok":true,"model":"muse-spark-1.3","reply":"ResearchForge connected"}`.
- Token-budget lesson: the test-call `max_tokens` was raised to **1024** because Muse Spark spends most of its budget on reasoning tokens (observed 76–390 reasoning tokens for a one-line reply). At 32–256 the call succeeded but the reply text came back empty. Keep generous token budgets on future model calls and check `finish`/empty content before assuming failure.

## How to run

1. Put the key in `server/.env` as `MODEL_API_KEY=<key>` (copy `server/.env.example` if needed).
2. `npm run install:all`
3. `npm run dev:server` — back end on http://localhost:8787
4. `npm run dev:client` — front end on http://localhost:5173, open that URL in a browser.
5. Optional CLI check: `npm run test-call`

## What is next — Phase 2: article intake and article map

- Let a student bring in one real scholarly article (intake).
- Build the article map the coaching flow will work from: the five appraisal areas from the README — (1) research question and background, (2) methods, (3) evidence, (4) findings, (5) limitations and applicability.
- Phase 2 details are not designed yet. Do not build coaching feedback, quote verification, sessions, or Word export until their phases — those come after the article map exists.

## Session log

- 2026-10-26 — Phase 1: scaffolded client and server, wired server-only key, ran and passed the test call (after raising the budget to 1024), committed and pushed `557f73b` on `main`. Created this file.
