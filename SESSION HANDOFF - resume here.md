# SESSION HANDOFF — read this first, then carry on

**Last written: 2026-10-28 (Vercel verified live as the only host.)**

## 🔴 THE ONE THING THAT WAS MID-FLIGHT
VERCEL WORKS (2026-10-28): the stable public link is https://researchforge-omega.vercel.app — verified end to end (health fingerprint `e2665bd7`, 9-model catalog incl. `muse-spark-1.3`, Sörman map, Q1 answered with verified quote, clean bundle; details in PROGRESS.md "Deployment — Vercel"). Send colleagues THIS link; no tunnel, no PC-awake requirement. The Cloudflare tunnel remains a proven fallback if Vercel ever fails.

## ✅ DONE THIS SESSION — do not redo any of it
- Phase 1 committed/pushed: `557f73b`. Phase 2 committed/pushed: `bcc42aa`. Phase 3 committed/pushed: `ad65e3e`, log update `4bef84d`. Phase 4 committed/pushed: `c72be28`. Accessibility fixes + test script committed/pushed: `9c70a63`.
- Phase 3 verified end to end with Sörman et al. (2025), BMC Medical Education, DOI 10.1186/s12909-025-08413-y, PMC12690956. Full text extracted to the session temp folder as `sorman2025.txt` (47,018 chars from "Abstract").
- Phase 4 server: `OVERALL_QUESTION` in `server/src/critique.js`, `priorRatings` support, `GET /api/questions` now also returns `overall`. Server tests: 14 passing (`npm test` in `server/`).
- Phase 4 client libs installed/created: `docx@9.15.0` in `client/package.json`, `client/src/session.ts` (localStorage), `client/src/exportDoc.ts` (Word builder).

## 📧 ANYTHING WAITING ON WENDY
- Nothing. Running the app needs her own two terminals (`npm run dev:server`, `npm run dev:client` from `C:\Users\wendy\Research_Forge`), then http://localhost:5173.

## ⏭️ NEXT, IN ORDER
1. Colleague testing via the stable Vercel link https://researchforge-omega.vercel.app plus `TESTER-INSTRUCTIONS.md`. Then fix what testers find.
2. Manual accessibility testing (`ACCESSIBILITY-TEST-SCRIPT.md`) whenever there is time.
2. Colleague testing using `TESTER-INSTRUCTIONS.md` (tasks, severity guide, feedback template) plus `ACCESSIBILITY-TEST-SCRIPT.md`; then fix what they find. Tester instructions and the "not medical advice" removal were committed and pushed as `c19d819`.
3. Manual accessibility testing (keyboard/screen reader/axe) is still pending whenever there is time.
2. Anything beyond Phase 4 is undesigned — ask before building.

## NOTES THAT SAVE REDISCOVERY
- Sandbox node cannot listen on ports; run servers with escalated permission via `Start-Process`.
- `node --test test/` fails on Windows here; the server test script uses `node --test "test/*.test.js"`.
- The API key lives only in `server/.env` as `MODEL_API_KEY`. Never commit it.
- `PROGRESS.md` is the standing continuity log; this file is only the crash-recovery snapshot.
