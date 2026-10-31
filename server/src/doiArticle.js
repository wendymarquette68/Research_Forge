// DOI article loading for intake. Accepts a bare DOI, a doi.org link, any
// publisher URL containing a DOI, or a PMC article link (resolved to its
// DOI through the NCBI ID converter, or loaded by PMCID from Europe PMC).
// 1. Crossref (free, no key) gives title, authors, journal, year.
// 2. Europe PMC gives the open-access full text as JATS XML, from which the
//    body is extracted section by section from Abstract through Discussion —
//    the same way the preloaded demo articles were built.
// A paywalled article is not an error: metadata comes back with no full
// text and the student pastes or uploads instead. Nothing here ever blocks
// intake beyond a clearly worded message.

const CROSSREF_BASE = 'https://api.crossref.org/works';
const EUROPEPMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';
const MIN_FULLTEXT_CHARS = 500;

/**
 * Normalisation order (students paste citation links, not just DOIs):
 * trim, then look for a PMCID, then for a DOI pattern anywhere in the input
 * (publisher URLs embed the DOI), then treat what is left as a bare DOI.
 */
export function extractPmcid(input) {
  if (typeof input !== 'string') return null;
  const match = input.match(/PMC(\d+)/i);
  return match ? `PMC${match[1]}` : null;
}

function cleanDoiCandidate(candidate) {
  let doi = String(candidate || '').trim();
  // Drop URL tail punctuation that is not part of the DOI; keep a balanced ')'.
  doi = doi.replace(/[.,;]+$/, '');
  if (doi.endsWith(')') && !doi.includes('(')) doi = doi.slice(0, -1);
  // Publisher page URLs can continue past the DOI (…/full, …/pdf, …/abstract).
  let previous = '';
  while (previous !== doi) {
    previous = doi;
    doi = doi.replace(/\/(full|pdf|epub|abstract|references?|supplementary-material|metrics|figures|tables)$/i, '');
  }
  return doi;
}

/** Return the bare DOI, or null when the input does not contain one. */
export function normalizeDoi(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  // A DOI pattern anywhere: bare DOIs, doi.org links, and publisher URLs.
  const anywhere = trimmed.match(/10\.\d{4,9}\/[^\s"'<>]+/);
  if (anywhere) {
    const doi = cleanDoiCandidate(anywhere[0]);
    if (/^10\.\d{4,9}\/\S+$/.test(doi)) return doi;
  }
  let doi = trimmed;
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  doi = doi.replace(/^doi\.org\//i, '');
  doi = doi.replace(/^doi:\s*/i, '');
  doi = doi.trim();
  if (!/^10\.\d{4,9}\/\S+$/.test(doi)) return null;
  return doi;
}

/** Resolve any accepted input form to { type: 'doi', doi } or { type: 'pmcid', pmcid }. */
export function resolveArticleIdentifier(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const pmcid = extractPmcid(input);
  if (pmcid) return { type: 'pmcid', pmcid };
  const doi = normalizeDoi(input);
  if (doi) return { type: 'doi', doi };
  return null;
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function authorName(author) {
  const family = cleanText(author?.family);
  if (!family) return '';
  const initials = cleanText(author?.given)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join('');
  return initials ? `${family} ${initials}` : family;
}

export function parseCrossrefWork(data) {
  const work = data?.message;
  if (!work || typeof work !== 'object') return null;
  const title = Array.isArray(work.title) ? cleanText(work.title[0]) : '';
  if (!title) return null;
  const authors = Array.isArray(work.author) ? work.author.map(authorName).filter(Boolean).join(', ') : '';
  const journal = Array.isArray(work['container-title']) ? cleanText(work['container-title'][0]) : '';
  const dateParts = work.published?.['date-parts'] || work.issued?.['date-parts'] || work.created?.['date-parts'];
  const year = Array.isArray(dateParts) && Array.isArray(dateParts[0]) ? String(dateParts[0][0] || '') : '';
  return { title, authors, journal, year };
}

// --- minimal JATS XML handling (same approach used to build the demo texts) ---

function parseXml(xml) {
  const root = { tag: '#root', children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) { stack.at(-1).children.push({ tag: '#text', text: m[1] }); continue; }
    if (m[6] !== undefined) { stack.at(-1).children.push({ tag: '#text', text: m[6] }); continue; }
    if (m[3] === undefined) continue;
    if (m[2] === '/') {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === m[3]) { stack.length = i; break; }
      }
    } else {
      const node = { tag: m[3], children: [] };
      stack.at(-1).children.push(node);
      if (m[5] !== '/') stack.push(node);
    }
  }
  return root;
}

const decodeEntities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&');

function textOf(node) {
  if (node.tag === '#text') return decodeEntities(node.text);
  return (node.children || []).map(textOf).join('');
}
const clean = (s) => decodeEntities(String(s || '')).replace(/\s+/g, ' ').trim();

function findFirst(node, tag) {
  if (!node.children) return null;
  if (node.tag === tag) return node;
  for (const child of node.children) {
    const hit = findFirst(child, tag);
    if (hit) return hit;
  }
  return null;
}
function findAll(node, tag, out = []) {
  if (!node.children) return out;
  if (node.tag === tag) out.push(node);
  for (const child of node.children) findAll(child, tag, out);
  return out;
}

function emitSection(sec, lines) {
  const titleNode = sec.children.find((c) => c.tag === 'title');
  const title = titleNode ? clean(textOf(titleNode)) : '';
  if (title) lines.push('', title, '');
  for (const child of sec.children) {
    if (child.tag === 'title') continue;
    if (child.tag === 'p') {
      const t = clean(textOf(child));
      if (t) lines.push(t, '');
    } else if (child.tag === 'sec') {
      emitSection(child, lines);
    } else if (child.tag === 'list') {
      for (const item of findAll(child, 'list-item')) {
        const t = clean(textOf(item));
        if (t) lines.push(`- ${t}`, '');
      }
    }
    // table-wrap / fig are skipped: tables are optional for the map flow.
  }
}

/** Extract readable article text from JATS XML: Abstract through Discussion. */
export function extractArticleTextFromXml(xml) {
  if (typeof xml !== 'string' || !xml.includes('<article')) return '';
  const root = parseXml(xml);
  const lines = ['Abstract', ''];
  const abstract = findFirst(root, 'abstract');
  if (abstract) {
    for (const child of abstract.children) {
      if (child.tag === 'sec') emitSection(child, lines);
      else if (child.tag === 'p') {
        const t = clean(textOf(child));
        if (t) lines.push(t, '');
      }
    }
  }
  const body = findFirst(root, 'body');
  if (body) {
    for (const sec of body.children.filter((c) => c.tag === 'sec')) {
      emitSection(sec, lines);
      const titleNode = sec.children.find((c) => c.tag === 'title');
      const title = titleNode ? clean(textOf(titleNode)) : '';
      if (/^discussion$/i.test(title)) break; // through the Discussion, inclusive
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function lookupError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const IDCONV_BASE = 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/';

/** PMCID -> DOI via the NCBI ID converter; null when it cannot resolve. */
export async function doiFromPmcid(pmcid, fetchFn = fetch) {
  try {
    const res = await fetchFn(`${IDCONV_BASE}?ids=${encodeURIComponent(pmcid)}&format=json`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const record = Array.isArray(data?.records) ? data.records[0] : null;
    return normalizeDoi(record?.doi || '') || null;
  } catch {
    return null;
  }
}

/** Metadata plus full text straight from Europe PMC for a PMCID (no DOI needed). */
export async function getPmcidArticle(pmcid, fetchFn = fetch) {
  const searchUrl = `${EUROPEPMC_BASE}/search?query=${encodeURIComponent(`PMCID:${pmcid}`)}&format=json&resultType=core&pageSize=1`;
  const searchRes = await fetchFn(searchUrl, { headers: { Accept: 'application/json' } });
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const result = searchData?.resultList?.result?.[0];
  if (!result || !cleanText(result.title)) return null;
  let fullText = null;
  try {
    const xmlRes = await fetchFn(`${EUROPEPMC_BASE}/${encodeURIComponent(pmcid)}/fullTextXML`);
    if (xmlRes.ok) {
      const extracted = extractArticleTextFromXml(await xmlRes.text());
      if (extracted.length >= MIN_FULLTEXT_CHARS) fullText = extracted;
    }
  } catch {
    fullText = null;
  }
  return {
    doi: normalizeDoi(result.doi || '') || '',
    title: cleanText(result.title),
    authors: cleanText(result.authorString),
    journal: cleanText(result.journalInfo?.journal?.title),
    year: result.pubYear ? String(result.pubYear) : '',
    fullText,
    openAccess: fullText !== null,
  };
}

/**
 * Full lookup for any accepted form (bare DOI, doi.org link, publisher URL
 * containing a DOI, or a PMC link). Returns { doi, title, authors, journal,
 * year, fullText, openAccess }. fullText is null (and openAccess false) when
 * the article is not freely available — that is a normal result, not a
 * throw. Throws only when the input cannot be looked up at all.
 */
export async function getDoiArticle({ doi: rawInput, fetchFn = fetch }) {
  const identifier = resolveArticleIdentifier(rawInput);
  if (!identifier) throw lookupError('INVALID_DOI', 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');

  if (identifier.type === 'pmcid') {
    // Preferred: resolve to the DOI, then run the normal DOI flow.
    const doi = await doiFromPmcid(identifier.pmcid, fetchFn);
    if (doi) return getDoiArticle({ doi, fetchFn });
    // Otherwise load metadata and full text from Europe PMC by PMCID.
    let byPmcid = null;
    try {
      byPmcid = await getPmcidArticle(identifier.pmcid, fetchFn);
    } catch {
      byPmcid = null;
    }
    if (byPmcid) return byPmcid;
    throw lookupError('DOI_NOT_FOUND', 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');
  }

  const doi = identifier.doi;

  let crossrefRes;
  try {
    crossrefRes = await fetchFn(`${CROSSREF_BASE}/${encodeURIComponent(doi)}`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw lookupError('DOI_LOOKUP_FAILED', 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');
  }
  if (crossrefRes.status === 404) {
    throw lookupError('DOI_NOT_FOUND', 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');
  }
  if (!crossrefRes.ok) {
    throw lookupError('DOI_LOOKUP_FAILED', 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');
  }
  let metadata = null;
  try {
    metadata = parseCrossrefWork(await crossrefRes.json());
  } catch {
    metadata = null;
  }
  if (!metadata) {
    throw lookupError('DOI_LOOKUP_FAILED', 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');
  }

  // Open-access full text through Europe PMC: DOI -> PMCID -> fullTextXML.
  let fullText = null;
  try {
    const searchUrl = `${EUROPEPMC_BASE}/search?query=${encodeURIComponent(`DOI:"${doi}"`)}&format=json&resultType=core&pageSize=1`;
    const searchRes = await fetchFn(searchUrl, { headers: { Accept: 'application/json' } });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const pmcid = searchData?.resultList?.result?.[0]?.pmcid;
      if (typeof pmcid === 'string' && pmcid) {
        const xmlRes = await fetchFn(`${EUROPEPMC_BASE}/${encodeURIComponent(pmcid)}/fullTextXML`);
        if (xmlRes.ok) {
          const extracted = extractArticleTextFromXml(await xmlRes.text());
          if (extracted.length >= MIN_FULLTEXT_CHARS) fullText = extracted;
        }
      }
    }
  } catch {
    // No open-access text: fall through with metadata only.
    fullText = null;
  }

  return { doi, ...metadata, fullText, openAccess: fullText !== null };
}
