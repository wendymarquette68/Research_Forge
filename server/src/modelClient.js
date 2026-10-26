// Server-only. MODEL_API_KEY is read here and never sent to the browser.
const baseUrl = (process.env.MODEL_API_BASE_URL || 'https://api.meta.ai/v1').replace(/\/$/, '');
const model = process.env.MODEL_NAME || 'muse-spark-1.3'; // plain id = standard mode

export function modelConfig() {
  return { baseUrl, model, hasKey: Boolean(process.env.MODEL_API_KEY) };
}

/** One OpenAI-compatible chat completion against the Meta Model API. */
export async function callModel(messages, { maxTokens = 64 } = {}) {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) {
    const err = new Error('MODEL_API_KEY is not set in server/.env');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Model API returned HTTP ${res.status}`);
    err.code = 'MODEL_API_ERROR';
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return {
    model: data.model || model,
    content: data.choices?.[0]?.message?.content ?? '',
    usage: data.usage ?? null,
    raw: data,
  };
}
