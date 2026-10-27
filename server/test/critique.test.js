import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS,
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
    quote: 'Participants were randomly assigned to a walking group or a wait-list control group.',
    quoteReference: 'Methods',
    followUp: 'What might threaten that strength?',
  }));
  assert.equal(f.rating, 'Developing');
  assert.equal(f.followUp, 'What might threaten that strength?');
});

test('parseFeedback rejects an unknown rating', () => {
  assert.throws(() => parseFeedback(JSON.stringify({
    rating: 'Excellent', gotRight: 'x', quote: 'q', followUp: 'y?',
  })));
});

const PADDED_ARTICLE = ARTICLE + '\n\n' + 'Additional background sentence for length. '.repeat(30);

test('validateCritiqueInput enforces the 25-word minimum', () => {
  const short = validateCritiqueInput({ articleText: PADDED_ARTICLE, areaId: 'methods', answer: 'Too short.' });
  assert.match(short.error, /25 words/);
  const ok = validateCritiqueInput({ articleText: PADDED_ARTICLE, areaId: 'methods', answer: LONG_ANSWER });
  assert.equal(ok.error, undefined);
  assert.equal(ok.areaId, 'methods');
});

test('validateCritiqueInput rejects an unknown area', () => {
  const bad = validateCritiqueInput({ articleText: PADDED_ARTICLE, areaId: 'nope', answer: LONG_ANSWER });
  assert.match(bad.error, /question/i);
});

function fakeModel(replies) {
  let calls = 0;
  return {
    calls: () => calls,
    callModel: async () => ({ model: 'fake', content: replies[Math.min(calls++, replies.length - 1)], usage: null }),
  };
}

const BAD_QUOTE_FEEDBACK = JSON.stringify({
  rating: 'Developing',
  gotRight: 'You noticed the random assignment.',
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
