# ResearchForge AI

ResearchForge AI coaches students to assess a scholarly article's strength instead of summarizing it for them.

## What it does

The student works through five questions about one real article: research question and background, methods, evidence, findings, and limitations and applicability. After each answer, the app judges the reasoning against the article itself, quotes the passage that supports or contradicts it, and asks one follow-up question. The student may revise once per question. At the end, the student writes an overall judgment of the article's strength, the app rates it, and the session exports as a Word document.

Three rules define the app:
- Every feedback message quotes a passage that exists word for word in the article. The server verifies each quote before it is shown.
- The AI coaches judgment. It never writes the model answer.
- This is research appraisal training for students. It is not medical advice.

## Who it is for

Undergraduate and early graduate students who must evaluate research for papers, literature reviews, or evidence-based practice assignments. The pilot audience is health professions students.

## Hackathon

Built for the Meta Global AI Developer Hackathon, Indie Developer track, Build for Your World theme, October 26 to November 4, 2026. Submissions due November 4 at 9:00 PM ET.

## What was built during the hackathon

All app code and features in this repository were built during the hackathon window, October 26 to November 4, 2026.

## Prior work disclosed

The project plan and the article-review rubric were authored by Wendy Whitner before the window and are not presented as hackathon-built work. The rubric is her classroom material, and the app implements it. Demo articles used for testing are open access publications, cited in the app, and are not the project's own work.

## Tech stack

- Front end: React, TypeScript, Tailwind CSS
- Back end: Node.js, Express
- AI: Meta Model API, muse-spark-1.3, standard mode, with the Files API, structured output, and prompt caching
- Storage: none on the server. Sessions live in the browser.
- Export: Word document

## Status

Phase 4 complete: the full flow — paste in one article, work through the five-question guided critique, write an overall judgment, and download the session as a Word document. Work is kept in the browser, so a reload does not lose it. Setup: (1) Put your Meta Model API key in server/.env as MODEL_API_KEY (gitignored) - see server/.env.example. (2) npm run install:all  (3) npm run dev:server  (4) npm run dev:client, then open http://localhost:5173 in a browser. Test call: npm run test-call (needs the key).

## Deploy on Vercel (stable-link option)

The repo also ships `vercel.json` plus a serverless entry at `api/index.mjs` (the same Express app, without `listen()`). Vercel serves the built client statically and routes `/api/*` to the function (60-second limit, enough for the measured model calls). Steps: Vercel dashboard → **Add New → Project** → import `wendymarquette68/Research_Forge` (branch `main`) → keep the detected settings from `vercel.json` → in **Environment Variables** add `MODEL_API_KEY` with your Meta Model API key (Vercel dashboard only, never in the repo) → **Deploy**. You get a stable `*.vercel.app` URL that never changes and needs no PC left awake. First check after deploy: open `/api/models` on the new URL — it must list `muse-spark-1.3`. If it returns an empty list, Meta is also gating Vercel's IPs and the Cloudflare-tunnel route remains the fallback.

## Deploy on Render

The repo ships a `render.yaml` blueprint. Two ways to create the service:

**Blueprint (recommended):** Render dashboard → New + → Blueprint → connect `wendymarquette68/Research_Forge` → Apply. The blueprint already sets the build command `npm run install:all && npm run build`, the start command `npm --prefix server run start`, and the health check `/api/health`.

**Manual Web Service:** Render dashboard → New + → Web Service → connect `wendymarquette68/Research_Forge`, branch `main`, runtime Node → Build Command `npm run install:all && npm run build` → Start Command `npm --prefix server run start` → Health Check Path `/api/health`.

**Required environment variable (both ways):** in the service's Environment tab add `MODEL_API_KEY` with your Meta Model API key. Set it in Render only — never in code, the front end, or the repo. The server reads it from the environment; the browser only calls `/api/*` routes on the same origin. `NODE_ENV=production` and `NODE_VERSION=22` are set by the blueprint (add them manually on the manual path).

In production the Express server serves the built client from `client/dist` and the API from the same origin, so the public Render URL is the only link testers need. Sessions persist in each tester's browser (localStorage); nothing is stored on the server. Note: on a free Render plan the service sleeps when idle, so the first visit after a pause can take up to a minute.
