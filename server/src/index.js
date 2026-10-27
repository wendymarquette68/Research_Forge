import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { callModel, modelConfig } from './modelClient.js';
import { buildArticleMapPrompt, parseArticleMap, validateArticleInput } from './articleMap.js';
import { getCritiqueFeedback, validateCritiqueInput, QUESTIONS } from './critique.js';

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const { model, baseUrl, hasKey } = modelConfig();
  res.json({ ok: true, model, baseUrl, hasKey });
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
    res.status(status).json({ ok: false, code: err.code || 'ERROR', error: err.message });
  }
});

// Phase 2: build the five-area article map from pasted article text.
// Map only — no coaching, no quote verification, no export in this phase.
app.post('/api/article-map', async (req, res) => {
  const input = validateArticleInput(req.body);
  if (input.error) {
    return res.status(400).json({ ok: false, code: 'INVALID_ARTICLE', error: input.error });
  }
  try {
    const { messages, truncated } = buildArticleMapPrompt(input);
    const result = await callModel(messages, { maxTokens: 6144 });
    const areas = parseArticleMap(result.content);
    return res.json({
      ok: true,
      model: result.model,
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
  res.json({ ok: true, questions: QUESTIONS.map(({ id, label, question }) => ({ id, label, question })) });
});

// Phase 3: one critique round. The article map stays on the server side of
// the judgement; quotes are verified word for word before they are returned.
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
    });
    return res.json({ ok: true, areaId: input.areaId, feedback });
  } catch (err) {
    const status = err.code === 'MISSING_API_KEY' ? 503 : err.status || 502;
    return res.status(status).json({ ok: false, code: err.code || 'ERROR', error: err.message });
  }
});

app.listen(port, () => {
  const { hasKey } = modelConfig();
  console.log(`ResearchForge server on http://localhost:${port}`);
  console.log(hasKey ? 'MODEL_API_KEY loaded (value not shown).' : 'WARNING: MODEL_API_KEY missing - set it in server/.env');
});
