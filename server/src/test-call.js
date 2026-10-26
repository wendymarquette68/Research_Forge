import 'dotenv/config';
import { callModel, modelConfig } from './modelClient.js';

const { model, baseUrl, hasKey } = modelConfig();
console.log(`Model: ${model}  Base: ${baseUrl}  Key present: ${hasKey}`);
if (!hasKey) {
  console.error('TEST CALL NOT RUN: MODEL_API_KEY is empty in server/.env. Add your key there and re-run: npm run test-call');
  process.exit(2);
}
try {
  const r = await callModel(
    [{ role: 'user', content: 'Reply with exactly: ResearchForge connected' }],
    { maxTokens: 1024 },
  );
  console.log('TEST CALL OK');
  console.log('Reply:', r.content);
  console.log('Usage:', JSON.stringify(r.usage));
} catch (err) {
  console.error(`TEST CALL FAILED (${err.code || 'ERROR'}${err.status ? ' HTTP ' + err.status : ''}): ${err.message}`);
  if (err.details) console.error(JSON.stringify(err.details).slice(0, 800));
  process.exit(1);
}
