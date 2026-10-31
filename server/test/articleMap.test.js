import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, buildArticleMapPrompt, parseArticleMap, getArticleMap, validateArticleInput } from '../src/articleMap.js';

const TEXT = 'Background: walking helps. '.repeat(40) + 'Methods: a trial was run. '.repeat(20);

const GOOD_MAP = JSON.stringify({
  areas: AREAS.map((a) => ({ id: a.id, summary: `${a.label} summary.`, keyPoints: ['one point'], quotes: [] })),
});
const BAD_MAP = 'Here is the map you asked for, in prose instead of JSON.';

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

test('parseArticleMap returns the five areas in order', () => {
  const areas = parseArticleMap(GOOD_MAP);
  assert.deepEqual(areas.map((a) => a.id), AREAS.map((a) => a.id));
});

test('buildArticleMapPrompt includes the article text and all five ids', () => {
  const { messages } = buildArticleMapPrompt({ title: 'T', authors: '', text: TEXT });
  const all = messages.map((m) => m.content).join('\n');
  assert.match(all, /walking helps/);
  for (const a of AREAS) assert.match(all, new RegExp(a.id));
});

test('getArticleMap retries once when the first response is unparseable', async () => {
  const fake = fakeModel([BAD_MAP, GOOD_MAP]);
  const { areas, truncated } = await getArticleMap({ callModel: fake.callModel, title: 'T', authors: '', text: TEXT });
  assert.equal(fake.calls(), 2);
  assert.equal(areas.length, 5);
  assert.equal(truncated, false);
  const retryPrompt = fake.seen[1].map((m) => m.content).join('\n');
  assert.match(retryPrompt, /only valid JSON/i);
});

test('getArticleMap succeeds on the first try without retrying', async () => {
  const fake = fakeModel([GOOD_MAP]);
  const { areas } = await getArticleMap({ callModel: fake.callModel, title: 'T', authors: '', text: TEXT });
  assert.equal(fake.calls(), 1);
  assert.equal(areas.length, 5);
});

test('getArticleMap fails with an actionable message after two unparseable responses', async () => {
  const fake = fakeModel([BAD_MAP, BAD_MAP]);
  await assert.rejects(
    () => getArticleMap({ callModel: fake.callModel, title: 'T', authors: '', text: TEXT }),
    (err) => {
      assert.match(err.message, /try again/i);
      assert.match(err.message, /paste/i);
      return true;
    },
  );
  assert.equal(fake.calls(), 2);
});

test('validateArticleInput enforces the 500-character minimum', () => {
  assert.match(validateArticleInput({ text: 'short' }).error, /500/);
  assert.equal(validateArticleInput({ text: TEXT }).error, undefined);
});
