# SESSION HANDOFF — read this first, then carry on

**Last written: 2026-10-27 (evening — Wendy tired, stopping for the night. Render diagnosis complete; key experiment is tomorrow's first step.)**

## 🔴 THE ONE THING THAT WAS MID-FLIGHT
The deployed app at https://researchforge-ai-d5jg.onrender.com (Oregon) loads and has the CORRECT key (health fingerprint `e2665bd7` = local key), but Meta returns an empty model catalog to Render's IPs (`/api/models` → `[]`; localhost with same key sees 9 models), so every model call 404s `model_not_found`. KEY EXPERIMENT DONE (2026-10-27 late): no restriction settings exist (Rename only). A fresh key in Render only (fingerprint `c55f03ef`) authenticates but STILL sees an empty catalog — keys are ruled out; Meta gates Render's egress IPs. Local key (`e2665bd7`) still works from home. NEXT STEP: Cloudflare Tunnel from Wendy's PC for colleague testing (steps in PROGRESS.md "Render deployment"), or try a different host and check `/api/models` before committing. When a working public link exists, run the full E2E (paste, map, one question with verified quote).

## ✅ DONE THIS SESSION — do not redo any of it
- Phase 1 committed/pushed: `557f73b`. Phase 2 committed/pushed: `bcc42aa`. Phase 3 committed/pushed: `ad65e3e`, log update `4bef84d`. Phase 4 committed/pushed: `c72be28`. Accessibility fixes + test script committed/pushed: `9c70a63`.
- Phase 3 verified end to end with Sörman et al. (2025), BMC Medical Education, DOI 10.1186/s12909-025-08413-y, PMC12690956. Full text extracted to the session temp folder as `sorman2025.txt` (47,018 chars from "Abstract").
- Phase 4 server: `OVERALL_QUESTION` in `server/src/critique.js`, `priorRatings` support, `GET /api/questions` now also returns `overall`. Server tests: 14 passing (`npm test` in `server/`).
- Phase 4 client libs installed/created: `docx@9.15.0` in `client/package.json`, `client/src/session.ts` (localStorage), `client/src/exportDoc.ts` (Word builder).

## 📧 ANYTHING WAITING ON WENDY
- Nothing. Running the app needs her own two terminals (`npm run dev:server`, `npm run dev:client` from `C:\Users\wendy\Research_Forge`), then http://localhost:5173.

## ⏭️ NEXT, IN ORDER
1. TOMORROW (2026-10-28): Meta key experiment — HOW TO GET BACK TO THE KEYS: go to https://dev.meta.ai and sign in → **API keys** tab. There: (a) click the existing key (its name, or the ⋯ menu) and look for fields named Restrictions, Allowed IPs / IP allowlist, Permissions, Models, or Status — if NO such fields exist, Meta exposes no IP restriction for these keys, so skip straight to making a new key; (b) to make a new key choose **Create API key**, copy it once (it is shown only once — starts with `LLM_`). Put the new key ONLY in Render (service → Environment → `MODEL_API_KEY` → save; Render redeploys itself) and do NOT change local `server/.env`. Then tell Muse to check `/api/models` on https://researchforge-ai-d5jg.onrender.com and run the E2E if models appear. Fallback if still empty: Cloudflare Tunnel from Wendy's PC. Keys need a payment method on the Meta account before they will issue.
2. Colleague testing using `TESTER-INSTRUCTIONS.md` (tasks, severity guide, feedback template) plus `ACCESSIBILITY-TEST-SCRIPT.md`; then fix what they find. Tester instructions and the "not medical advice" removal were committed and pushed as `c19d819`.
3. Manual accessibility testing (keyboard/screen reader/axe) is still pending whenever there is time.
2. Anything beyond Phase 4 is undesigned — ask before building.

## NOTES THAT SAVE REDISCOVERY
- Sandbox node cannot listen on ports; run servers with escalated permission via `Start-Process`.
- `node --test test/` fails on Windows here; the server test script uses `node --test "test/*.test.js"`.
- The API key lives only in `server/.env` as `MODEL_API_KEY`. Never commit it.
- `PROGRESS.md` is the standing continuity log; this file is only the crash-recovery snapshot.
