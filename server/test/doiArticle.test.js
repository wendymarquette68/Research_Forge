import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDoi, parseCrossrefWork, extractArticleTextFromXml, getDoiArticle } from '../src/doiArticle.js';

test('normalizeDoi accepts a bare DOI', () => {
  assert.equal(normalizeDoi('10.1186/s12909-025-08413-y'), '10.1186/s12909-025-08413-y');
  assert.equal(normalizeDoi('10.3389/fpubh.2025.1565212'), '10.3389/fpubh.2025.1565212');
});

test('normalizeDoi strips doi.org prefixes and whitespace', () => {
  assert.equal(normalizeDoi('  https://doi.org/10.1186/s12909-025-08413-y  '), '10.1186/s12909-025-08413-y');
  assert.equal(normalizeDoi('http://dx.doi.org/10.3389/fpubh.2025.1565212'), '10.3389/fpubh.2025.1565212');
  assert.equal(normalizeDoi('doi.org/10.1000/xyz123'), '10.1000/xyz123');
  assert.equal(normalizeDoi('doi: 10.1000/xyz123'), '10.1000/xyz123');
});

test('normalizeDoi rejects input that is not a DOI', () => {
  assert.equal(normalizeDoi(''), null);
  assert.equal(normalizeDoi('not a doi'), null);
  assert.equal(normalizeDoi('https://example.com/article'), null);
  assert.equal(normalizeDoi('1186/s12909-025-08413-y'), null);
  assert.equal(normalizeDoi(null), null);
  assert.equal(normalizeDoi(undefined), null);
});

const CROSSREF = {
  message: {
    title: ['Epidemic-induced changes in nursing students professional identity'],
    author: [
      { family: 'Zhang', given: 'Huiting' },
      { family: 'He', given: 'Wenhao' },
      { family: 'Sörman', given: 'Karolina Anne' },
    ],
    'container-title': ['Frontiers in Public Health'],
    published: { 'date-parts': [[2025, 5, 14]] },
  },
};

test('parseCrossrefWork reads title, authors, journal, and year', () => {
  const meta = parseCrossrefWork(CROSSREF);
  assert.match(meta.title, /professional identity/);
  assert.equal(meta.authors, 'Zhang H, He W, Sörman KA');
  assert.equal(meta.journal, 'Frontiers in Public Health');
  assert.equal(meta.year, '2025');
  assert.equal(parseCrossrefWork({}), null);
  assert.equal(parseCrossrefWork({ message: { title: [] } }), null);
});

const LONG_PARA = 'This paragraph discusses the point in enough detail to read like article body text for extraction testing purposes. '.repeat(4);
const XML = `<?xml version="1.0"?><article><front><article-meta><title-group><article-title>Probe</article-title></title-group></article-meta></front>
<abstract><sec><title>Objective</title><p>To explore the probe question in this study of testing.</p></sec></abstract>
<body>
<sec><title>Introduction</title><p>${LONG_PARA}</p></sec>
<sec><title>Methods</title><p>${LONG_PARA}</p><sec><title>Design</title><p>${LONG_PARA}</p></sec></sec>
<sec><title>Discussion</title><p>${LONG_PARA}</p></sec>
<sec><title>Conclusions</title><p>THIS SHOULD NOT BE INCLUDED in the extracted text at all.</p></sec>
</body><back><ref-list><ref><label>1</label><p>Reference text that must not appear either.</p></ref></ref-list></back></article>`;

test('extractArticleTextFromXml takes Abstract through Discussion only', () => {
  const text = extractArticleTextFromXml(XML);
  assert.match(text, /^Abstract/);
  assert.match(text, /Objective/);
  assert.match(text, /Discussion/);
  assert.ok(!text.includes('THIS SHOULD NOT BE INCLUDED'));
  assert.ok(!text.includes('must not appear'));
  assert.equal(extractArticleTextFromXml('not xml'), '');
  assert.equal(extractArticleTextFromXml(''), '');
});

const jsonRes = (data, status = 200) => ({ ok: status === 200, status, json: async () => data, text: async () => JSON.stringify(data) });
const xmlRes = (xml) => ({ ok: true, status: 200, json: async () => ({}), text: async () => xml });

test('getDoiArticle returns metadata plus full text for an open-access DOI', async () => {
  const fetchFn = async (url) => {
    const u = String(url);
    if (u.includes('api.crossref.org')) return jsonRes(CROSSREF);
    if (u.includes('/search?')) return jsonRes({ resultList: { result: [{ pmcid: 'PMC1234567' }] } });
    if (u.includes('/PMC1234567/fullTextXML')) return xmlRes(XML);
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  const result = await getDoiArticle({ doi: 'https://doi.org/10.3389/fpubh.2025.1565212', fetchFn });
  assert.equal(result.doi, '10.3389/fpubh.2025.1565212');
  assert.equal(result.openAccess, true);
  assert.match(result.fullText, /Discussion/);
  assert.ok(result.fullText.length >= 500);
  assert.equal(result.journal, 'Frontiers in Public Health');
});

test('getDoiArticle paywalled fallback: metadata with no full text, not an error', async () => {
  const fetchFn = async (url) => {
    const u = String(url);
    if (u.includes('api.crossref.org')) return jsonRes(CROSSREF);
    if (u.includes('/search?')) return jsonRes({ resultList: { result: [] } }); // no PMCID: not open access
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  const result = await getDoiArticle({ doi: '10.3389/fpubh.2025.1565212', fetchFn });
  assert.equal(result.openAccess, false);
  assert.equal(result.fullText, null);
  assert.match(result.title, /professional identity/);
  assert.equal(result.authors, 'Zhang H, He W, Sörman KA');
});

test('getDoiArticle paywalled fallback when Europe PMC search fails', async () => {
  const fetchFn = async (url) => {
    if (String(url).includes('api.crossref.org')) return jsonRes(CROSSREF);
    throw new Error('network down');
  };
  const result = await getDoiArticle({ doi: '10.3389/fpubh.2025.1565212', fetchFn });
  assert.equal(result.openAccess, false);
  assert.equal(result.fullText, null);
});

test('getDoiArticle rejects an invalid DOI with an actionable code', async () => {
  await assert.rejects(
    () => getDoiArticle({ doi: 'not-a-doi', fetchFn: async () => jsonRes(CROSSREF) }),
    (err) => err.code === 'INVALID_DOI' && /paste/i.test(err.message),
  );
});

test('getDoiArticle reports a Crossref 404 as DOI_NOT_FOUND', async () => {
  const fetchFn = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' });
  await assert.rejects(
    () => getDoiArticle({ doi: '10.9999/does.not.exist', fetchFn }),
    (err) => err.code === 'DOI_NOT_FOUND' && /looked up/i.test(err.message),
  );
});
