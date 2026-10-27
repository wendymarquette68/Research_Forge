# ResearchForge AI — Progress / Continuity Log

> **Next session: read this file first and pick up exactly where we left off.**
> Update this file at the end of every session and after each phase completes.

## Standing rules

- The API key lives only in `server/.env` as `MODEL_API_KEY`. Never put it in this file, in chat, in front-end code, or in any committed file.
- The AI coaches student judgment. It never writes the model answer.
- Every feedback message must quote a passage that exists word for word in the article. The server verifies each quote before it is shown.
- This is research appraisal training for students. It is not medical advice.

## Current state — Phase 4 COMPLETE (2026-10-27)

- Phase 1 commit `557f73b` on `main`, pushed to `https://github.com/wendymarquette68/Research_Forge`. Phase 2 committed and pushed as `bcc42aa` on `main`. Phase 3 committed and pushed as `ad65e3e` on `main`. Phase 4 committed and pushed as `c72be28` on `main`.
- Scaffold built: React + TypeScript + Tailwind front end (`client/`), Node.js + Express back end (`server/`).
- Phase 2 built: article intake (paste full text) and the five-area article map. See Verified below.
- Phase 2 design choices (settled 2026-10-27): intake is paste full text with title/authors fields (no PDF upload, no bundled demo article); the map is AI-extracted with verbatim quotes; scope stops at the map — no coaching, no quote verification, no saved sessions, no Word export yet.
- Phase 3 built: the guided critique loop — five questions in order, 25-word minimum answers, JSON feedback (rating, what the learner got right, one verified verbatim quote with passage reference, one follow-up), one revision per question, and server-side word-for-word quote verification with one retry. The map stays hidden from the learner during the loop. See Verified — Phase 3 below.
- Phase 4 built: summary screen with first and revised ratings side by side, an overall-judgment question rated the same way, a Download Word document button (docx library), and browser localStorage persistence so a reload keeps the student's work. See Verified — Phase 4 below.

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

## Verified — Phase 4 (2026-10-27)

- Overall judgment: `areaId: 'overall'` on the existing `POST /api/critique`, with `OVERALL_QUESTION` in [critique.js](/C:/Users/wendy/Research_Forge/server/src/critique.js) ("How much should a reader trust this study, and how could it be used?"). Same 25-word minimum, same rating scale, same verified-quote rule with one retry and flagged withholding. The learner's five final ratings are sent as context so the coach can judge consistency. `GET /api/questions` now also returns the overall question. Server tests grew to 14, all passing.
- Summary screen ([App.tsx](/C:/Users/wendy/Research_Forge/client/src/App.tsx)): after the fifth question, a table shows each question with its first and revised ratings side by side, then the overall-judgment box and its feedback, then the Download Word document button (enabled once the overall judgment is submitted).
- Word export ([exportDoc.ts](/C:/Users/wendy/Research_Forge/client/src/exportDoc.ts), `docx` library, generated in the browser — still no server storage): article title and authors, each question with first and revised answers, ratings, what the learner got right, the quoted passages with their passage references, follow-up questions, and the overall judgment with its rating and quote. Verified quotes only; a withheld quote is recorded as withheld, never invented.
- Persistence ([session.ts](/C:/Users/wendy/Research_Forge/client/src/session.ts)): the full session — article text, hidden map, answers and revisions, ratings, drafts, and the overall judgment — is saved to browser localStorage on every change and restored on load. Corrupt or outdated saved data is ignored safely. "Critique another article" clears it. Nothing is stored on the server.
- End-to-end verified with the Sörman et al. (2025) article (same text as Phase 3): map built; all five critiques returned verified quotes (Developing ×3, Proficient ×2); one revision accepted (Proficient, verified); the overall judgment returned Proficient with a quote that passed server verification and the independent recheck. The Word document was then generated from that exact session by the real client export module: it opened as a valid .docx and its text contains the article title and authors, all five questions, first and revised answers and ratings, every quoted passage, and the overall judgment. The persistence round-trip was verified with the real session module (saved session parses back identically, stage "summary", attempt counts 2,1,1,1,1; corrupt data returns null). The summary page and the overall question were also confirmed through the Vite proxy at http://localhost:5173. Not directly observed: a literal browser reload and a click on the download button — no browser automation was driven in this environment; the reload path is covered by the storage round-trip above plus the passing build.

## Accessibility fixes (2026-10-27, after Phase 4)

- Code fixes applied toward WCAG 2.1 AA (the Title II standard), committed and pushed as `9c70a63` on `main`, together with a manual test script at [ACCESSIBILITY-TEST-SCRIPT.md](/C:/Users/wendy/Research_Forge/ACCESSIBILITY-TEST-SCRIPT.md): all small gray text moved from stone-500 (4.40:1 on the page background) to stone-700 (9.42:1); placeholders darkened to stone-600 (7.63:1). A "Skip to main content" link, a strong `:focus-visible` outline, `prefers-reduced-motion` handling, and focus management were added: focus moves to the question heading when the loop advances, to the feedback card when coach feedback arrives, to the answer box when revising, and to the summary/overall feedback at the end. A polite live region announces mapping, feedback ratings, and download completion. Hints and errors are now associated with their fields (`aria-describedby`, `aria-invalid`), the progress list marks the current question (`aria-current="step"`), and the summary table has a caption and scoped column headers. The Word export now carries document title/subject/creator/description metadata on top of its real heading styles.
- Verified by code and build only: server tests still 14/14, `tsc -b` and `npm run build` pass, the built bundle contains the skip link and focus styles, no `text-stone-500` remains, and a regenerated .docx contains the new core metadata. NOT yet done: keyboard-only walkthrough, NVDA/JAWS/VoiceOver testing, an axe/Lighthouse run, and a screen-reader check of the exported Word file. Until those pass, do not claim Title II conformance — say "accessibility fixes applied, manual assistive-technology testing still pending."

## Render deployment (2026-10-27)

- Deploy-ready for Render as a single web service from `main`: [render.yaml](/C:/Users/wendy/Research_Forge/render.yaml) blueprint (build `npm run install:all && npm run build`, start `npm --prefix server run start`, health check `/api/health`, `NODE_ENV=production`, `NODE_VERSION=22`, `MODEL_API_KEY` with `sync: false` so the value is set in the dashboard only). In production the Express server also serves the built client from `client/dist` (see [index.js](/C:/Users/wendy/Research_Forge/server/src/index.js)), so the public link is one origin and the browser only calls `/api/*`. Exact dashboard steps (Blueprint or manual Web Service, plus the `MODEL_API_KEY` environment variable) are in the README section "Deploy on Render".
- Verified locally in production mode: root build passes, the server serves the page at `/` (200, app shell present), `/api/questions` returns the five questions plus overall, and the built front end contains no `MODEL_API_KEY` and no `api.meta.ai` string. The client source only fetches `/api/health`, `/api/questions`, `/api/article-map`, and `/api/critique`.
- Still to do by Wendy: create the service in the Render dashboard and set `MODEL_API_KEY` there. After she shares the public URL, verify end to end on the public link: paste an article, build the map, answer one question with a verified quote, write an overall judgment, download the Word document, and reload to confirm the work persists. On a free plan the service sleeps when idle (first visit can take up to a minute).

## What is next

- Manual accessibility testing (keyboard walkthrough, one screen reader, axe run, Word-file check), then any fixes those surface. Tester-facing instructions for colleagues are at [TESTER-INSTRUCTIONS.md](/C:/Users/wendy/Research_Forge/TESTER-INSTRUCTIONS.md) (tasks, severity guide, feedback template); the accessibility checklist itself is [ACCESSIBILITY-TEST-SCRIPT.md](/C:/Users/wendy/Research_Forge/ACCESSIBILITY-TEST-SCRIPT.md).
- Public-link verification after the Render deploy (see above).
- The README flow is complete end to end: intake, hidden map, five-question critique, overall judgment, Word export. Remaining ideas, none designed or scheduled: whether the overall judgment should also allow one revision, and any pre-submission polish (demo script, README screenshots). Do not start either without a new instruction.

## Session log

- 2026-10-26 — Phase 1: scaffolded client and server, wired server-only key, ran and passed the test call (after raising the budget to 1024), committed and pushed `557f73b` on `main`. Created this file.
- 2026-10-27 — Phase 2: settled design (paste intake, AI-extracted map with quotes, map-only scope), built `POST /api/article-map` and the intake/map UI, verified build plus a live end-to-end map. Committed and pushed as `bcc42aa` on `main`.
- 2026-10-27 — Phase 3: built the guided critique loop (`GET /api/questions`, `POST /api/critique`, hidden map, quote verification with one retry and flagged withholding), added 12 committed server tests, verified end to end with the Sörman et al. (2025) article (all five questions, verified quotes, one revision). Committed and pushed as `ad65e3e` on `main`.
- 2026-10-27 — Phase 4: built the summary screen with side-by-side ratings, the overall judgment (same verified-quote feedback), Word export with the `docx` library, and localStorage persistence. Server tests now 14. Verified end to end with the Sörman article including a generated .docx containing the full critique and a storage round-trip. Committed and pushed as `c72be28` on `main`.
- 2026-10-27 — Accessibility: applied WCAG 2.1 AA code fixes (contrast, skip link, focus visibility/management, live announcements, field-linked errors, table caption, Word metadata), wrote `ACCESSIBILITY-TEST-SCRIPT.md` for the manual keyboard/screen-reader/axe/Word testing still pending. Committed and pushed as `9c70a63` on `main`.
- 2026-10-27 — Wrote `TESTER-INSTRUCTIONS.md` for colleague testing, and removed the "not medical advice" wording from app-visible surfaces (app footer and Word export text/metadata) because it does not fit the app. Committed and pushed as `c19d819` on `main`.
- 2026-10-27 — Render deploy prep: production static serving of the built client from Express, `render.yaml` blueprint, README deploy steps, local production-mode verification (page + API + clean bundle). Committed and pushed as `2b248df` on `main`. Public deploy and public-link verification wait on Wendy creating the service and setting `MODEL_API_KEY` in Render.
