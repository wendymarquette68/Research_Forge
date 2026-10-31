import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callModel, listModels, modelConfig } from './modelClient.js';
import { getArticleMap, validateArticleInput } from './articleMap.js';
import { getCritiqueFeedback, validateCritiqueInput, QUESTIONS, OVERALL_QUESTION } from './critique.js';

// Express app without listen(): local start goes through index.js,
// Vercel imports it as a serverless function via api/index.mjs.
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const { model, baseUrl, hasKey, keyFingerprint } = modelConfig();
  res.json({ ok: true, model, baseUrl, hasKey, keyFingerprint });
});

// Diagnostic: which models this server's key/network context can see.
app.get('/api/models', async (_req, res) => {
  try {
    const models = await listModels();
    res.json({ ok: true, models });
  } catch (err) {
    const status = err.code === 'MISSING_API_KEY' ? 503 : err.status || 502;
    res.status(status).json({ ok: false, code: err.code || 'ERROR', error: err.message, details: err.details || null });
  }
});

// The one small connectivity check. No key ever leaves the server.
app.post('/api/test-call', async (_req, res) => {
  try {
    const result = await callModel(
      [{ role: 'user', content: 'Reply with exactly: ResearchForge connected' }],
      { maxTokens: 1024 },
    );
    res.json({ ok: true, model: result.model, reply: result.content, usage: result.usage });
  } catch (err) {
    const status = err.code === 'MISSING_API_KEY' ? 503 : err.status || 502;
    res.status(status).json({ ok: false, code: err.code || 'ERROR', error: err.message, details: err.details || null });
  }
});

// Phase 2: build the five-area article map from pasted article text.
app.post('/api/article-map', async (req, res) => {
  const input = validateArticleInput(req.body);
  if (input.error) {
    return res.status(400).json({ ok: false, code: 'INVALID_ARTICLE', error: input.error });
  }
  try {
    const { areas, truncated, model } = await getArticleMap({ callModel, ...input });
    return res.json({
      ok: true,
      model,
      article: { title: input.title || 'Untitled article', authors: input.authors || '' },
      truncated,
      areas,
    });
  } catch (err) {
    const status = err.code === 'MISSING_API_KEY' ? 503 : err.status || 502;
    return res.status(status).json({ ok: false, code: err.code || 'ERROR', error: err.message });
  }
});

app.get('/api/questions', (_req, res) => {
  res.json({
    ok: true,
    questions: QUESTIONS.map(({ id, label, question }) => ({ id, label, question })),
    overall: { id: OVERALL_QUESTION.id, label: OVERALL_QUESTION.label, question: OVERALL_QUESTION.question },
  });
});

// Phase 3/4: one critique round (or the overall judgment). The article map
// stays on the server side of the judgement; quotes are verified word for
// word before they are returned.
app.post('/api/critique', async (req, res) => {
  const input = validateCritiqueInput(req.body);
  if (input.error) {
    return res.status(400).json({ ok: false, code: 'INVALID_CRITIQUE', error: input.error });
  }
  try {
    const feedback = await getCritiqueFeedback({
      callModel,
      articleText: input.articleText,
      title: input.title,
      areaId: input.areaId,
      mapArea: input.mapArea,
      answer: input.answer,
      priorRatings: input.priorRatings,
    });
    return res.json({ ok: true, areaId: input.areaId, feedback });
  } catch (err) {
    const status = err.code === 'MISSING_API_KEY' ? 503 : err.status || 502;
    return res.status(status).json({ ok: false, code: err.code || 'ERROR', error: err.message });
  }
});

// Single-process hosting (local production): serve the built
// client from this same service so the public link is one origin and the
// browser only ever calls /api/* routes. On Vercel the platform serves
// client/dist itself and this block simply finds no dist next to the API.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('Serving built client from client/dist.');
}

export default app;
