# ResearchForge AI — Progress / Continuity Log

> **Next session: read this file first and pick up exactly where we left off.**
> Update this file at the end of every session and after each phase completes.

## Standing rules

- The API key lives only in `server/.env` as `MODEL_API_KEY`. Never put it in this file, in chat, in front-end code, or in any committed file.
- The AI coaches student judgment. It never writes the model answer.
- Every feedback message must quote a passage that exists word for word in the article. The server verifies each quote before it is shown.
- This is research appraisal training for students. It is not medical advice.

## Current state — Phase 3 COMPLETE (2026-10-27)

- Phase 1 commit `557f73b` on `main`, pushed to `https://github.com/wendymarquette68/Research_Forge`. Phase 2 committed and pushed as `bcc42aa` on `main`. Phase 3 changes are in the working tree, not yet committed.
- Scaffold built: React + TypeScript + Tailwind front end (`client/`), Node.js + Express back end (`server/`).
- Phase 2 built: article intake (paste full text) and the five-area article map. See Verified below.
- Phase 2 design choices (settled 2026-10-27): intake is paste full text with title/authors fields (no PDF upload, no bundled demo article); the map is AI-extracted with verbatim quotes; scope stops at the map — no coaching, no quote verification, no saved sessions, no Word export yet.
- Phase 3 built: the guided critique loop — five questions in order, 25-word minimum answers, JSON feedback (rating, what the learner got right, one verified verbatim quote with passage reference, one follow-up), one revision per question, and server-side word-for-word quote verification with one retry. The map stays hidden from the learner during the loop. See Verified — Phase 3 below.

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

## Verified — Phase 3 (2026-10-27)

- New endpoints: `GET /api/questions` (the five critique questions in order) and `POST /api/critique` in [index.js](/C:/Users/wendy/Research_Forge/server/src/index.js), with the logic in [critique.js](/C:/Users/wendy/Research_Forge/server/src/critique.js). The server enforces the 25-word minimum (clear 400 message), rates at Emerging / Developing / Proficient, and returns what the learner got right, one quote, its passage reference, and one follow-up question. The prompt forbids writing a model answer; the follow-up must lead the learner to a gap rather than supply it.
- Quote rule enforced server-side: every quote is checked word for word against the pasted article text (whitespace differences from pasting are ignored, wording and punctuation are not). A failed quote triggers one retry with a corrective instruction. If the retry still fails, the feedback is returned with the quote withheld and a clear flag — an unverified quote is never shown. References are computed server-side as "Passage N of the pasted article (Section)" because pasted text has no page numbers; the model's own reference is never trusted.
- The hidden map is sent back per question as the judging reference and is never rendered during the loop. The front end ([App.tsx](/C:/Users/wendy/Research_Forge/client/src/App.tsx)) now runs intake → five-question loop (answer, feedback, optional one revision, next) → completion screen listing the final rating per area. Overall judgment and Word export are still not built.
- Committed tests: [critique.test.js](/C:/Users/wendy/Research_Forge/server/test/critique.test.js) — 12 tests (quote verification exact/whitespace/altered, passage reference, feedback parsing, 25-word and unknown-area validation, retry-then-verified and retry-then-withheld paths), run with `npm test` in `server/` (or `npm test` at the root). All 12 pass. Client `tsc -b` and `npm run build` pass; the built bundle contains no `MODEL_API_KEY` and no `api.meta.ai` string.
- End-to-end verified with the Sörman article — Sörman et al. (2025), "Virtual patient simulation strengthens confidence in clinical conversations among undergraduated nursing students: a randomized controlled trial," BMC Medical Education, DOI 10.1186/s12909-025-08413-y (open access, PMC12690956), pasted at 47,018 characters: the map built with all five areas; a 2-word answer was rejected with the 25-word message; all five questions returned feedback with quotes that passed server verification and an independent word-for-word recheck (ratings: Developing ×3, Proficient ×2); one revision of the first question was accepted and its rating rose from Developing to Proficient, again with a verified quote. The page and question list were also confirmed through the Vite proxy at http://localhost:5173.

## What is next — Phase 4: overall judgment and Word export

- After the five questions, the learner writes one overall judgment of the article's strength, the app rates it, and the session exports as a Word document (per the README).
- Phase 4 details are not designed yet. Before building, settle: the overall-judgment prompt and rating scale, what the Word document contains (answers, revisions, feedback, verified quotes), and how the export is generated (client or server). Do not add saved sessions until their own phase, if ever — storage is still none on the server.

## Session log

- 2026-10-26 — Phase 1: scaffolded client and server, wired server-only key, ran and passed the test call (after raising the budget to 1024), committed and pushed `557f73b` on `main`. Created this file.
- 2026-10-27 — Phase 2: settled design (paste intake, AI-extracted map with quotes, map-only scope), built `POST /api/article-map` and the intake/map UI, verified build plus a live end-to-end map. Committed and pushed as `bcc42aa` on `main`.
- 2026-10-27 — Phase 3: built the guided critique loop (`GET /api/questions`, `POST /api/critique`, hidden map, quote verification with one retry and flagged withholding), added 12 committed server tests, verified end to end with the Sörman et al. (2025) article (all five questions, verified quotes, one revision). Not yet committed.
