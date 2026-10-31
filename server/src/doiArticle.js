// DOI article loading for intake.
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

/** Accept a bare DOI or a doi.org link; return the bare DOI, or null when it cannot be one. */
export function normalizeDoi(input) {
  if (typeof input !== 'string') return null;
  let doi = input.trim();
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  doi = doi.replace(/^doi\.org\//i, '');
  doi = doi.replace(/^doi:\s*/i, '');
  doi = doi.trim();
  // DOI shape: 10.<registrant>/<suffix>, no spaces.
  if (!/^10\.\d{4,9}\/\S+$/.test(doi)) return null;
  return doi;
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

/**
 * Full DOI lookup. Returns { doi, title, authors, journal, year, fullText,
 * openAccess }. fullText is null (and openAccess false) when the article is
 * not freely available — that is a normal result, not a throw. Throws only
 * when the DOI itself cannot be looked up.
 */
export async function getDoiArticle({ doi: rawDoi, fetchFn = fetch }) {
  const doi = normalizeDoi(rawDoi);
  if (!doi) throw lookupError('INVALID_DOI', 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');

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
