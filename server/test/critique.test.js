import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS,
  OVERALL_QUESTION,
  verifyQuote,
  findPassageReference,
  parseFeedback,
  validateCritiqueInput,
  getCritiqueFeedback,
} from '../src/critique.js';

const ARTICLE = [
  'Background: Walking programmes are often proposed to lower blood pressure in older adults.',
  '',
  'Methods: We recruited 84 adults aged 65 and over from two community centres. Participants were randomly assigned to a walking group or a wait-list control group.',
  '',
  'Findings: Systolic blood pressure fell by a mean of 6.2 mmHg in the walking group compared with 1.1 mmHg in the control group.',
].join('\n');

const LONG_ANSWER = 'The methods look reasonably strong because participants were randomly assigned, which reduces selection bias, and the outcome was measured the same way in both groups, although the small sample from only two centres limits how far the results can be generalised.';

test('QUESTIONS lists the five areas in order', () => {
  assert.deepEqual(
    QUESTIONS.map((q) => q.id),
    ['research-question', 'methods', 'evidence', 'findings', 'limitations'],
  );
  for (const q of QUESTIONS) assert.ok(q.question.length > 20);
});

test('verifyQuote accepts an exact quote', () => {
  assert.equal(verifyQuote('We recruited 84 adults aged 65 and over from two community centres.', ARTICLE).verified, true);
});

test('verifyQuote accepts a quote differing only in whitespace', () => {
  assert.equal(verifyQuote('We recruited 84 adults aged 65 and over\nfrom two community centres.', ARTICLE).verified, true);
});

test('verifyQuote rejects a quote with an altered word', () => {
  assert.equal(verifyQuote('We recruited 85 adults aged 65 and over from two community centres.', ARTICLE).verified, false);
});

test('verifyQuote rejects an empty quote', () => {
  assert.equal(verifyQuote('', ARTICLE).verified, false);
  assert.equal(verifyQuote('   ', ARTICLE).verified, false);
});

test('findPassageReference locates the passage', () => {
  const ref = findPassageReference(ARTICLE, 'Systolic blood pressure fell by a mean of 6.2 mmHg in the walking group');
  assert.match(ref, /Passage 3/);
});

test('parseFeedback parses valid JSON and keeps the rating', () => {
  const f = parseFeedback(JSON.stringify({
    rating: 'Developing',
    gotRight: 'You spotted the random assignment.',
    conceptNote: 'Random assignment means chance, not the researchers, decided who walked, so the groups start out alike.',
    quote: 'Participants were randomly assigned to a walking group or a wait-list control group.',
    quoteReference: 'Methods',
    followUp: 'What might threaten that strength?',
  }));
  assert.equal(f.rating, 'Developing');
  assert.equal(f.followUp, 'What might threaten that strength?');
});

test('parseFeedback keeps a concept note only for Emerging or Developing', () => {
  const developing = parseFeedback(JSON.stringify({
    rating: 'Developing', gotRight: 'x', conceptNote: 'A control group is the comparison group that does not get the programme.', quote: 'q', followUp: 'y?',
  }));
  assert.match(developing.conceptNote, /control group/i);
  const proficient = parseFeedback(JSON.stringify({
    rating: 'Proficient', gotRight: 'x', conceptNote: 'Should be dropped.', quote: 'q', followUp: 'y?',
  }));
  assert.equal(proficient.conceptNote, '');
  const missing = parseFeedback(JSON.stringify({
    rating: 'Emerging', gotRight: 'x', quote: 'q', followUp: 'y?',
  }));
  assert.equal(missing.conceptNote, '');
});

test('parseFeedback rejects an unknown rating', () => {
  assert.throws(() => parseFeedback(JSON.stringify({
    rating: 'Excellent', gotRight: 'x', quote: 'q', followUp: 'y?',
  })));
});

const PADDED_ARTICLE = ARTICLE + '\n\n' + 'Additional background sentence for length. '.repeat(30);

test('validateCritiqueInput enforces the 15-word minimum', () => {
  const short = validateCritiqueInput({ articleText: PADDED_ARTICLE, areaId: 'methods', answer: 'Too short.' });
  assert.match(short.error, /15 words/);
  const fourteen = validateCritiqueInput({
    articleText: PADDED_ARTICLE, areaId: 'methods',
    answer: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen',
  });
  assert.match(fourteen.error, /15 words/);
  const fifteen = validateCritiqueInput({
    articleText: PADDED_ARTICLE, areaId: 'methods',
    answer: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen',
  });
  assert.equal(fifteen.error, undefined);
  const ok = validateCritiqueInput({ articleText: PADDED_ARTICLE, areaId: 'methods', answer: LONG_ANSWER });
  assert.equal(ok.error, undefined);
  assert.equal(ok.areaId, 'methods');
});

test('validateCritiqueInput rejects an unknown area', () => {
  const bad = validateCritiqueInput({ articleText: PADDED_ARTICLE, areaId: 'nope', answer: LONG_ANSWER });
  assert.match(bad.error, /question/i);
});

test('overall judgment is a valid critique target with the same word minimum', () => {
  assert.equal(OVERALL_QUESTION.id, 'overall');
  assert.match(OVERALL_QUESTION.question, /trust/i);
  const short = validateCritiqueInput({ articleText: PADDED_ARTICLE, areaId: 'overall', answer: 'I trust it.' });
  assert.match(short.error, /15 words/);
  const ok = validateCritiqueInput({
    articleText: PADDED_ARTICLE,
    areaId: 'overall',
    answer: LONG_ANSWER,
    priorRatings: [{ label: 'Methods', rating: 'Developing' }],
  });
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.priorRatings, [{ label: 'Methods', rating: 'Developing' }]);
});

function fakeModel(replies) {
  let calls = 0;
  const seen = [];
  return {
    calls: () => calls,
    seen,
    callModel: async (messages) => {
      seen.push(messages);
      return { model: 'fake', content: replies[Math.min(calls++, replies.length - 1)], usage: null };
    },
  };
}

const BAD_QUOTE_FEEDBACK = JSON.stringify({
  rating: 'Developing',
  gotRight: 'You noticed the random assignment.',
  conceptNote: 'Random assignment means chance decided the groups, so they start out alike.',
  quote: 'This sentence was never in the article at all.',
  quoteReference: 'Methods',
  followUp: 'What else could bias the comparison?',
});
const GOOD_QUOTE_FEEDBACK = JSON.stringify({
  rating: 'Proficient',
  gotRight: 'You noticed the random assignment and why it matters.',
  quote: 'Participants were randomly assigned to a walking group or a wait-list control group.',
  quoteReference: 'Methods',
  followUp: 'What else could bias the comparison?',
});
const DEVELOPING_GOOD_QUOTE = JSON.stringify({
  rating: 'Developing',
  gotRight: 'You noticed the random assignment.',
  conceptNote: 'A wait-list control group waits for the programme, so the walking group can be compared against people who have not walked yet.',
  quote: 'Participants were randomly assigned to a walking group or a wait-list control group.',
  quoteReference: 'Methods',
  followUp: 'What else could bias the comparison?',
});

test('getCritiqueFeedback returns the concept note for Developing and asks for it in the prompt', async () => {
  const fake = fakeModel([DEVELOPING_GOOD_QUOTE]);
  const fb = await getCritiqueFeedback({
    callModel: fake.callModel,
    articleText: ARTICLE,
    title: 'Walking trial',
    areaId: 'methods',
    mapArea: { summary: 'Randomised trial in two centres.', keyPoints: [], quotes: [] },
    answer: LONG_ANSWER,
  });
  assert.equal(fb.rating, 'Developing');
  assert.match(fb.conceptNote, /wait-list control group/i);
  const promptText = fake.seen.flat().map((m) => m.content).join('\n');
  assert.match(promptText, /conceptNote/);
  assert.match(promptText, /Emerging or Developing/);
  assert.match(promptText, /plain language/i);
});

test('getCritiqueFeedback retries once when the first quote fails verification', async () => {
  const fake = fakeModel([BAD_QUOTE_FEEDBACK, GOOD_QUOTE_FEEDBACK]);
  const fb = await getCritiqueFeedback({
    callModel: fake.callModel,
    articleText: ARTICLE,
    title: 'Walking trial',
    areaId: 'methods',
    mapArea: { summary: 'Randomised trial in two centres.', keyPoints: [], quotes: [] },
    answer: LONG_ANSWER,
  });
  assert.equal(fake.calls(), 2);
  assert.equal(fb.quoteVerified, true);
  assert.match(fb.quote, /randomly assigned/);
  assert.match(fb.quoteReference, /Passage/);
});

test('getCritiqueFeedback handles the overall judgment', async () => {
  const fake = fakeModel([GOOD_QUOTE_FEEDBACK]);
  const fb = await getCritiqueFeedback({
    callModel: fake.callModel,
    articleText: ARTICLE,
    title: 'Walking trial',
    areaId: 'overall',
    mapArea: null,
    answer: LONG_ANSWER,
    priorRatings: [{ label: 'Methods', rating: 'Developing' }],
  });
  assert.equal(fb.quoteVerified, true);
  assert.equal(fb.rating, 'Proficient');
});

test('getCritiqueFeedback drops and flags the quote when the retry still fails', async () => {
  const fake = fakeModel([BAD_QUOTE_FEEDBACK, BAD_QUOTE_FEEDBACK]);
  const fb = await getCritiqueFeedback({
    callModel: fake.callModel,
    articleText: ARTICLE,
    title: 'Walking trial',
    areaId: 'methods',
    mapArea: null,
    answer: LONG_ANSWER,
  });
  assert.equal(fake.calls(), 2);
  assert.equal(fb.quoteVerified, false);
  assert.equal(fb.quote, null);
  assert.ok(fb.quoteFlag);
  assert.equal(fb.rating, 'Developing');
});
