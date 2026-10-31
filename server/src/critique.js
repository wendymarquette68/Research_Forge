// Guided critique loop for Phase 3.
// The coach judges the learner answer against the hidden article map and the
// article itself. It never writes a model answer. Every quote is verified
// word for word against the pasted article text before it can be shown.

export const RATINGS = ['Emerging', 'Developing', 'Proficient'];
export const MIN_ANSWER_WORDS = 15;
const MAX_ARTICLE_CHARS = 60000;

export const QUESTIONS = [
  {
    id: 'research-question',
    label: 'Research question and background',
    question:
      'In your own words, what question does this study set out to answer, and how well does the background justify why that question matters? Point to what the authors themselves say.',
  },
  {
    id: 'methods',
    label: 'Methods',
    question:
      'How did the researchers carry out the study, and how well do those methods fit the question? Comment on who or what was studied, how the study was set up, and how data were collected.',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    question:
      'What evidence did the study gather, and how complete or trustworthy does that evidence look to you? Consider who took part, how many, and what was actually measured.',
  },
  {
    id: 'findings',
    label: 'Findings',
    question:
      'What did the study find, and how clearly do those findings answer the research question? Stick to what the authors report, not what you expected.',
  },
  {
    id: 'limitations',
    label: 'Limitations and applicability',
    question:
      'What are the main limitations of this study, and how far can its findings be applied beyond the people and setting studied? Use limits the article supports, including any the authors name themselves.',
  },
];

function normalizeWhitespace(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

/** A quote passes only if its words appear word for word, in order, in the article. Whitespace differences from pasting are ignored. */
export function verifyQuote(quote, articleText) {
  const q = normalizeWhitespace(quote || '');
  if (!q || !articleText) return { verified: false };
  if (articleText.includes(quote)) return { verified: true };
  return { verified: normalizeWhitespace(articleText).includes(q) };
}

const SECTION_WORDS = [
  'Abstract', 'Background', 'Introduction', 'Methods', 'Method',
  'Results', 'Findings', 'Discussion', 'Limitations', 'Conclusion', 'Conclusions',
];

/** "Passage N" reference, plus the nearest section heading when one can be found. Pasted text has no page numbers, so passages are the reference. */
export function findPassageReference(articleText, quote) {
  const passages = String(articleText).split(/\n\s*\n/);
  const q = normalizeWhitespace(quote || '');
  let idx = passages.findIndex((p) => normalizeWhitespace(p).includes(q));
  if (idx === -1) {
    // Fall back to a character search on the whole text.
    const pos = normalizeWhitespace(articleText).indexOf(q);
    if (pos === -1) return 'Passage reference unavailable';
    idx = normalizeWhitespace(articleText).slice(0, pos).split(/\n\s*\n/).length - 1;
    if (idx < 0) idx = 0;
  }
  let section = '';
  for (let i = idx; i >= 0; i--) {
    const firstLine = normalizeWhitespace(passages[i]).slice(0, 80);
    const hit = SECTION_WORDS.find(
      (w) => firstLine === w || firstLine.startsWith(w + ' ') || firstLine.startsWith(w + ':'),
    );
    if (hit) { section = hit; break; }
  }
  return section
    ? `Passage ${idx + 1} of the pasted article (${section})`
    : `Passage ${idx + 1} of the pasted article`;
}

export function parseFeedback(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    const err = new Error('The coach returned an empty response. Please try again.');
    err.code = 'EMPTY_MODEL_RESPONSE';
    throw err;
  }
  let jsonText = rawContent.trim();
  jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    const err = new Error('The coach returned an unreadable response. Please try again.');
    err.code = 'BAD_MODEL_RESPONSE';
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText.slice(start, end + 1));
  } catch {
    const err = new Error('The coach returned an unreadable response. Please try again.');
    err.code = 'BAD_MODEL_RESPONSE';
    throw err;
  }
  const rating = RATINGS.find((r) => r.toLowerCase() === String(parsed?.rating || '').trim().toLowerCase());
  if (!rating) {
    const err = new Error('The coach returned an unreadable rating. Please try again.');
    err.code = 'BAD_MODEL_RESPONSE';
    throw err;
  }
  const gotRight = typeof parsed.gotRight === 'string' ? parsed.gotRight.trim() : '';
  const followUp = typeof parsed.followUp === 'string' ? parsed.followUp.trim() : '';
  if (!gotRight || !followUp) {
    const err = new Error('The coach returned an incomplete response. Please try again.');
    err.code = 'BAD_MODEL_RESPONSE';
    throw err;
  }
  // A concept note is only for Emerging or Developing ratings; never keep one for Proficient.
  const conceptNote = rating === 'Proficient'
    ? ''
    : (typeof parsed.conceptNote === 'string' ? parsed.conceptNote.trim() : '');
  const quoteRoleRaw = typeof parsed.quoteRole === 'string' ? parsed.quoteRole.trim().toLowerCase() : '';
  const quoteRole = quoteRoleRaw === 'supports' || quoteRoleRaw === 'challenges' ? quoteRoleRaw : '';
  return {
    rating,
    gotRight,
    conceptNote,
    quote: typeof parsed.quote === 'string' ? parsed.quote.trim() : '',
    quoteRole,
    followUp,
  };
}

export const OVERALL_QUESTION = {
  id: 'overall',
  label: 'Overall judgment',
  question:
    'How much should a reader trust this study, and how could it be used? Give your overall judgment of the article strength, drawing together what you found in the five areas.',
};

const ALL_QUESTIONS = [...QUESTIONS, OVERALL_QUESTION];

export function countWords(text) {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

export function validateCritiqueInput(body) {
  const articleText = typeof body?.articleText === 'string' ? body.articleText.trim() : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const areaId = typeof body?.areaId === 'string' ? body.areaId.trim() : '';
  const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';
  const question = ALL_QUESTIONS.find((q) => q.id === areaId);
  if (!question) return { error: 'Unknown critique question. Start the critique again from the first question.' };
  if (articleText.length < 500) return { error: 'The article text is missing or too short. Paste the article again.' };
  const words = countWords(answer);
  if (words < MIN_ANSWER_WORDS) {
    return { error: `Your answer is ${words} word${words === 1 ? '' : 's'}. Write at least ${MIN_ANSWER_WORDS} words so the coach has enough of your reasoning to judge.` };
  }
  const rawMap = body?.mapArea;
  const mapArea = rawMap && typeof rawMap === 'object'
    ? {
        summary: typeof rawMap.summary === 'string' ? rawMap.summary : '',
        keyPoints: Array.isArray(rawMap.keyPoints) ? rawMap.keyPoints.filter((k) => typeof k === 'string') : [],
        quotes: Array.isArray(rawMap.quotes) ? rawMap.quotes.filter((k) => typeof k === 'string') : [],
      }
    : null;
  const priorRatings = Array.isArray(body?.priorRatings)
    ? body.priorRatings
        .filter((r) => r && typeof r.label === 'string' && typeof r.rating === 'string')
        .slice(0, 5)
        .map((r) => ({ label: r.label, rating: r.rating }))
    : [];
  return { articleText, title, areaId, answer, question, mapArea, priorRatings };
}

function buildCritiqueMessages({ title, question, mapArea, answer, articleText, retryNote, priorRatings }) {
  const truncated = articleText.length > MAX_ARTICLE_CHARS;
  const text = truncated ? articleText.slice(0, MAX_ARTICLE_CHARS) : articleText;
  const system = [
    'You are the ResearchForge AI coach. You coach student judgment on one scholarly article. You never write a model answer, a corrected answer, or the appraisal for the learner.',
    'Judge only the learner answer below, against the hidden article map excerpt and the article text.',
    'Rate the reasoning exactly one of: Emerging, Developing, Proficient. Emerging means the answer mostly retells or misses the question. Developing means it engages the article but is partial or shaky. Proficient means it makes a clear, article-grounded judgment.',
    'Say briefly what the learner got right. Do not supply the points they missed as a finished answer; your follow-up question should lead them to notice one gap themselves.',
    'If the rating is Emerging or Developing, put a brief explanation in conceptNote before the follow-up question: in plain language, explain the one key term or concept the learner missed or used shakily (for example random assignment, a control group, sample size, or generalisability), in two to four short sentences a first-time reader can follow. Cover three things: what the term means, why it matters for judging this article, and whether a point like this normally belongs in an article review and where it goes in the review (which of the five areas, or the overall judgment, it belongs in). Explain the term itself only — do not turn it into their answer or tell them what to write. If the rating is Proficient, conceptNote must be an empty string.',
    'Quote exactly one passage, copied word for word from the article text, that supports or challenges the learner answer. Copy it character for character. Keep it under 240 characters. Never invent or tidy up a quote. In quoteRole, say whether that passage "supports" or "challenges" the learner answer, so the learner knows why it is shown.',
    'Ask exactly one follow-up question. Make it push deeper, not just ask for the next detail: lead the learner to think about other stakeholders (for example patients, clinicians, educators, services, or policymakers) and the overall impact of the research or intervention if its findings were acted on, in a way that fits this question area. Still do not supply the answer.',
    'Return only valid JSON. No markdown fences. No extra prose.',
    retryNote || '',
  ].join(' ');
  const user = [
    `Article: ${title || 'Untitled article'}`,
    truncated ? `Note: article text truncated to ${MAX_ARTICLE_CHARS} characters.` : '',
    '',
    `Question area: ${question.label}`,
    `Question asked: ${question.question}`,
    '',
    'HIDDEN ARTICLE MAP FOR THIS AREA (reference only — never repeat it to the learner as an answer):',
    mapArea ? `Summary: ${mapArea.summary}\nKey points: ${mapArea.keyPoints.join('; ') || '(none)'}` : '(no map available)',
    priorRatings && priorRatings.length
      ? `Learner final ratings on the five areas: ${priorRatings.map((r) => `${r.label}: ${r.rating}`).join('; ')}. Judge whether the overall judgment is consistent with that pattern, without treating the ratings as the answer.`
      : '',
    '',
    'LEARNER ANSWER:',
    answer,
    '',
    'Return JSON in exactly this shape:',
    '{"rating":"Developing","gotRight":"one or two sentences on what the learner got right","conceptNote":"for Emerging or Developing only: plain-language explanation of the key term missed, why it matters, and where it goes in a review; empty string for Proficient","quote":"one verbatim passage","quoteReference":"section or passage the quote came from","quoteRole":"supports or challenges","followUp":"one deeper follow-up question about stakeholders and overall impact"}',
    '',
    'ARTICLE TEXT:',
    text,
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/**
 * One feedback round. If the quote fails verification, the model is retried
 * once. If it still fails, the feedback is returned without the quote,
 * clearly flagged — an unverified quote is never shown.
 */
export async function getCritiqueFeedback({ callModel, articleText, title, areaId, mapArea, answer, priorRatings }) {
  const question = ALL_QUESTIONS.find((q) => q.id === areaId);
  if (!question) {
    const err = new Error('Unknown critique question.');
    err.code = 'BAD_AREA';
    throw err;
  }
  let lastFeedback = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote = attempt === 1
      ? 'IMPORTANT: your previous quote could not be found word for word in the article text. Copy the quote exactly, character for character, from the article text below. Choose a shorter passage if that helps.'
      : '';
    const messages = buildCritiqueMessages({ title, question, mapArea, answer, articleText, retryNote, priorRatings });
    const result = await callModel(messages, { maxTokens: 6144 });
    lastFeedback = parseFeedback(result.content);
    if (lastFeedback.quote && verifyQuote(lastFeedback.quote, articleText).verified) {
      return {
        rating: lastFeedback.rating,
        gotRight: lastFeedback.gotRight,
        conceptNote: lastFeedback.conceptNote,
        quote: lastFeedback.quote,
        quoteReference: findPassageReference(articleText, lastFeedback.quote),
        quoteVerified: true,
        quoteFlag: null,
        quoteRole: lastFeedback.quoteRole,
        followUp: lastFeedback.followUp,
      };
    }
  }
  return {
    rating: lastFeedback.rating,
    gotRight: lastFeedback.gotRight,
    conceptNote: lastFeedback.conceptNote,
    quote: null,
    quoteReference: null,
    quoteVerified: false,
    quoteFlag: 'The coach quoted a passage that could not be verified word for word in your pasted article, so the quote has been withheld. The rest of this feedback still stands — check the point against the article yourself.',
    quoteRole: '',
    followUp: lastFeedback.followUp,
  };
}
