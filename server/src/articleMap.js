// Article map extraction for Phase 2.
// The model only maps the article. It does not judge strength and does not
// write any student answer. Quote verification is a later phase.

export const AREAS = [
  { id: 'research-question', label: 'Research question and background' },
  { id: 'methods', label: 'Methods' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'findings', label: 'Findings' },
  { id: 'limitations', label: 'Limitations and applicability' },
];

const MAX_ARTICLE_CHARS = 60000;

export function buildArticleMapPrompt({ title, authors, text }) {
  const truncated = text.length > MAX_ARTICLE_CHARS;
  const articleText = truncated ? text.slice(0, MAX_ARTICLE_CHARS) : text;
  const system = [
    'You build an article map for ResearchForge AI, a research appraisal trainer.',
    'Your job is only to map what the article says. Do not judge the article strength.',
    'Do not write a student answer, an appraisal, or a recommendation.',
    'Do not add information that is not in the article.',
    'Copy every quote exactly, word for word, from the article text. Keep each quote under 280 characters.',
    'If an area is not clearly stated in the article, say so plainly in the summary and return an empty quotes list for that area.',
    'Return only valid JSON. No markdown fences. No extra prose.',
  ].join(' ');
  const user = [
    `Article title: ${title || 'Untitled article'}`,
    authors ? `Authors: ${authors}` : 'Authors: (not provided)',
    truncated ? `Note: the article text below was truncated to ${MAX_ARTICLE_CHARS} characters.` : '',
    '',
    'Return JSON in exactly this shape:',
    '{"areas":[{"id":"research-question","summary":"2-3 sentence neutral summary","keyPoints":["short extracted fact"],"quotes":["verbatim excerpt"]}]}',
    '',
    'Include all five areas, in this order, with these ids:',
    AREAS.map((a) => `- ${a.id} (${a.label})`).join('\n'),
    '',
    'For each area give: a 2-3 sentence neutral summary, 2-4 short keyPoints, and 1-2 verbatim quotes.',
    '',
    'ARTICLE TEXT:',
    articleText,
  ].filter(Boolean).join('\n');
  return { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], truncated };
}

export function parseArticleMap(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    const err = new Error('The model returned an empty response. Please try again.');
    err.code = 'EMPTY_MODEL_RESPONSE';
    throw err;
  }
  let jsonText = rawContent.trim();
  jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    const err = new Error('The model did not return a readable article map. Please try again.');
    err.code = 'BAD_MODEL_RESPONSE';
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    const err = new Error('The model did not return a readable article map. Please try again.');
    err.code = 'BAD_MODEL_RESPONSE';
    throw err;
  }
  const byId = new Map();
  if (Array.isArray(parsed?.areas)) {
    for (const area of parsed.areas) {
      if (area && typeof area.id === 'string') byId.set(area.id, area);
    }
  }
  return AREAS.map(({ id, label }) => {
    const found = byId.get(id) || {};
    const quotes = Array.isArray(found.quotes)
      ? found.quotes.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim()).slice(0, 2)
      : [];
    const keyPoints = Array.isArray(found.keyPoints)
      ? found.keyPoints.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim()).slice(0, 4)
      : [];
    return {
      id,
      label,
      summary: typeof found.summary === 'string' && found.summary.trim()
        ? found.summary.trim()
        : 'Not clearly stated in the article text provided.',
      keyPoints,
      quotes,
    };
  });
}

export function validateArticleInput(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const authors = typeof body?.authors === 'string' ? body.authors.trim() : '';
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return { error: 'Paste the full article text to build the map.' };
  if (text.length < 500) {
    return { error: `Article text is too short (${text.length} characters). Paste the full article text (at least 500 characters).` };
  }
  if (text.length > 200000) {
    return { error: 'Article text is too long. Paste at most 200,000 characters.' };
  }
  return { title, authors, text };
}
