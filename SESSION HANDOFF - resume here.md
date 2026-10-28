# SESSION HANDOFF — read this first, then carry on

**Last written: 2026-10-27 (evening — Wendy tired, stopping for the night. Render diagnosis complete; key experiment is tomorrow's first step.)**

## 🔴 THE ONE THING THAT WAS MID-FLIGHT
The deployed app at https://researchforge-ai-d5jg.onrender.com (Oregon) loads and has the CORRECT key (health fingerprint `e2665bd7` = local key), but Meta returns an empty model catalog to Render's IPs (`/api/models` → `[]`; localhost with same key sees 9 models), so every model call 404s `model_not_found`. TUNNEL WORKS (2026-10-28): Wendy runs a Cloudflare quick tunnel from her PC and it was verified end to end that morning (page, 9-model catalog, Sörman map, Q1 rated Proficient with verified quote, clean bundle — details in PROGRESS.md "Render deployment"). For each testing day: `npm run build` once, `npm run dev:server` (window 1), `cloudflared tunnel --url http://localhost:8787` (window 2), share the NEW trycloudflare URL from window 2 (URLs change every run), keep PC plugged in/awake with sleep = Never. Render remains unusable while Meta gates its IPs (two valid keys see an empty catalog there); leave the Render service as-is.

## ✅ DONE THIS SESSION — do not redo any of it
- Phase 1 committed/pushed: `557f73b`. Phase 2 committed/pushed: `bcc42aa`. Phase 3 committed/pushed: `ad65e3e`, log update `4bef84d`. Phase 4 committed/pushed: `c72be28`. Accessibility fixes + test script committed/pushed: `9c70a63`.
- Phase 3 verified end to end with Sörman et al. (2025), BMC Medical Education, DOI 10.1186/s12909-025-08413-y, PMC12690956. Full text extracted to the session temp folder as `sorman2025.txt` (47,018 chars from "Abstract").
- Phase 4 server: `OVERALL_QUESTION` in `server/src/critique.js`, `priorRatings` support, `GET /api/questions` now also returns `overall`. Server tests: 14 passing (`npm test` in `server/`).
- Phase 4 client libs installed/created: `docx@9.15.0` in `client/package.json`, `client/src/session.ts` (localStorage), `client/src/exportDoc.ts` (Word builder).

## 📧 ANYTHING WAITING ON WENDY
- Nothing. Running the app needs her own two terminals (`npm run dev:server`, `npm run dev:client` from `C:\Users\wendy\Research_Forge`), then http://localhost:5173.

## ⏭️ NEXT, IN ORDER
1. Colleague testing via the Cloudflare tunnel (see mid-flight note above for the daily startup steps and today's verification). Email colleagues the day's tunnel URL plus `TESTER-INSTRUCTIONS.md`.
2. Colleague testing using `TESTER-INSTRUCTIONS.md` (tasks, severity guide, feedback template) plus `ACCESSIBILITY-TEST-SCRIPT.md`; then fix what they find. Tester instructions and the "not medical advice" removal were committed and pushed as `c19d819`.
3. Manual accessibility testing (keyboard/screen reader/axe) is still pending whenever there is time.
2. Anything beyond Phase 4 is undesigned — ask before building.

## NOTES THAT SAVE REDISCOVERY
- Sandbox node cannot listen on ports; run servers with escalated permission via `Start-Process`.
- `node --test test/` fails on Windows here; the server test script uses `node --test "test/*.test.js"`.
- The API key lives only in `server/.env` as `MODEL_API_KEY`. Never commit it.
- `PROGRESS.md` is the standing continuity log; this file is only the crash-recovery snapshot.
