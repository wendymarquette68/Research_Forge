import app from './app.js';
import { modelConfig } from './modelClient.js';

const port = Number(process.env.PORT || 8787);

app.listen(port, () => {
  const { hasKey } = modelConfig();
  console.log(`ResearchForge server on http://localhost:${port}`);
  console.log(hasKey ? 'MODEL_API_KEY loaded (value not shown).' : 'WARNING: MODEL_API_KEY missing - set it in server/.env');
});
