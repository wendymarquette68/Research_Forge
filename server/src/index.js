import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { callModel, modelConfig } from './modelClient.js';

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '256kb' }));

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

app.listen(port, () => {
  const { hasKey } = modelConfig();
  console.log(`ResearchForge server on http://localhost:${port}`);
  console.log(hasKey ? 'MODEL_API_KEY loaded (value not shown).' : 'WARNING: MODEL_API_KEY missing - set it in server/.env');
});
