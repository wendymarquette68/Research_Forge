# ResearchForge AI — Progress / Continuity Log

> **Next session: read this file first and pick up exactly where we left off.**
> Update this file at the end of every session and after each phase completes.

## Standing rules

- The API key lives only in `server/.env` as `MODEL_API_KEY`. Never put it in this file, in chat, in front-end code, or in any committed file.
- The AI coaches student judgment. It never writes the model answer.
- Every feedback message must quote a passage that exists word for word in the article. The server verifies each quote before it is shown.
- This is research appraisal training for students. It is not medical advice.

## Current state — Phase 2 COMPLETE (2026-10-27)

- Phase 1 commit `557f73b` on `main`, pushed to `https://github.com/wendymarquette68/Research_Forge`. Phase 2 changes are in the working tree, not yet committed.
- Scaffold built: React + TypeScript + Tailwind front end (`client/`), Node.js + Express back end (`server/`).
- Phase 2 built: article intake (paste full text) and the five-area article map. See Verified below.
- Phase 2 design choices (settled 2026-10-27): intake is paste full text with title/authors fields (no PDF upload, no bundled demo article); the map is AI-extracted with verbatim quotes; scope stops at the map — no coaching, no quote verification, no saved sessions, no Word export yet.

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

## Verified — Phase 2 (2026-10-27)

- New endpoint `POST /api/article-map` in [index.js](/C:/Users/wendy/Research_Forge/server/src/index.js): validates pasted text (minimum 500 characters, clear 400 error when too short), then builds the map via [articleMap.js](/C:/Users/wendy/Research_Forge/server/src/articleMap.js). Express JSON limit raised to 1mb for pasted articles. Articles over 60,000 characters are mapped from the first 60,000 and flagged `truncated`.
- The map always returns the five areas in order — research question and background, methods, evidence, findings, limitations and applicability — each with a neutral summary, key points, and up to two quotes the model is instructed to copy word for word. The prompt forbids judging strength or writing a student answer. Malformed model JSON returns a clean retry error, never a crash.
- Front end ([App.tsx](/C:/Users/wendy/Research_Forge/client/src/App.tsx)): title and authors fields, full-text paste box with character/word counts, Build article map button, and the five-area map display with quoted passages. Article and map live only in the browser tab — nothing is saved.
- Checks run: `tsc -b` passes; `npm run build` passes; live probe against the running server returned health OK, a 400 for too-short text, and a 200 map with all five areas populated. All 10 quotes in that probe matched the source text exactly (observed once — systematic quote verification is still a later phase, not built yet). Built bundle and front-end source contain no `MODEL_API_KEY` and no `api.meta.ai` string.
- Not done yet, by design: coaching feedback, server quote verification, sessions/saving, and Word export.

## What is next — Phase 3: coaching flow

- Work through the five areas one at a time: the student writes an appraisal answer per area, the app responds against the article map and the article itself, and asks one follow-up. The student may revise once per question (per the README).
- Phase 3 details are not designed yet. Before building, settle: the per-area question wording, how feedback quotes and verifies passages (the standing quote rule applies here), and how the overall final judgment and rating work. Do not build Word export until the coaching flow exists.

## Session log

- 2026-10-26 — Phase 1: scaffolded client and server, wired server-only key, ran and passed the test call (after raising the budget to 1024), committed and pushed `557f73b` on `main`. Created this file.
- 2026-10-27 — Phase 2: settled design (paste intake, AI-extracted map with quotes, map-only scope), built `POST /api/article-map` and the intake/map UI, verified build plus a live end-to-end map. Changes not yet committed.
