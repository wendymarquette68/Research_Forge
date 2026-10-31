// Browser-only PDF text extraction for article intake.
// The PDF file is read on this device with pdf.js. The file itself is never
// sent to or stored on a server; only the extracted text the student sees
// (and can edit) goes through the same article-map flow as pasted text.

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// pdf.js is imported lazily inside extractPdfText so the main page bundle
// does not carry it for students who paste text instead.

export type PdfExtraction = {
  text: string;
  pageCount: number;
  title: string;
};

type TextItemLike = { str: string; hasEOL?: boolean; transform?: number[] };

/**
 * Join one page's text items into lines. When pdf.js reports positions,
 * lines are rebuilt in visual reading order (top to bottom, left to right):
 * publisher PDFs often stream the licence block and running headers first,
 * which would otherwise bury the title and scramble the first page.
 */
export function assemblePageText(items: TextItemLike[]): string {
  const usable = items.filter((item) => item.str);
  if (usable.some((item) => Array.isArray(item.transform) && item.transform.length >= 6)) {
    const sorted = [...usable].sort((a, b) => {
      const ay = a.transform?.[5] ?? 0;
      const by = b.transform?.[5] ?? 0;
      if (Math.abs(by - ay) > 2) return by - ay;
      return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
    });
    const lines: string[] = [];
    let currentY: number | null = null;
    let current = '';
    for (const item of sorted) {
      const y = item.transform?.[5] ?? 0;
      if (currentY === null || Math.abs(y - currentY) > 2) {
        if (current.trim()) lines.push(current);
        current = '';
        currentY = y;
      }
      current += item.str.endsWith(' ') || current.endsWith(' ') ? item.str : ` ${item.str}`;
    }
    if (current.trim()) lines.push(current);
    return lines
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }
  let out = '';
  for (const item of usable) {
    out += item.str;
    out += item.hasEOL ? '\n' : ' ';
  }
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const TITLE_SKIP_LABELS = new Set([
  'RESEARCH', 'RESEARCH ARTICLE', 'ORIGINAL ARTICLE', 'ORIGINAL RESEARCH',
  'REVIEW', 'REVIEW ARTICLE', 'SYSTEMATIC REVIEW', 'META-ANALYSIS', 'EDITORIAL',
  'COMMENTARY', 'PERSPECTIVE', 'CASE REPORT', 'STUDY PROTOCOL', 'ARTICLE',
  'OPEN ACCESS', 'RESEARCH PAPER', 'SHORT COMMUNICATION', 'BRIEF REPORT',
]);

function despaced(line: string): string {
  // Publisher headers letter-space words: "R E S E A R C H" -> "RESEARCH".
  return line.replace(/\b(?:[A-Za-z] ){2,}[A-Za-z]\b/g, (m) => m.replace(/ /g, ''));
}

const TITLE_LABEL_WORDS = new Set([
  'RESEARCH', 'OPEN', 'ACCESS', 'ORIGINAL', 'ARTICLE', 'REVIEW', 'SYSTEMATIC',
  'META-ANALYSIS', 'EDITORIAL', 'COMMENTARY', 'PERSPECTIVE', 'CASE', 'REPORT',
  'STUDY', 'PROTOCOL', 'PAPER', 'SHORT', 'COMMUNICATION', 'BRIEF',
]);

function isSkippableTitleLine(line: string, nextLine: string): boolean {
  const upper = despaced(line).toUpperCase();
  if (TITLE_SKIP_LABELS.has(upper)) return true;
  if (upper.startsWith('OPEN ACCESS')) return true;
  // Combined label lines such as "R E S E A R C H Open Access".
  const tokens = upper.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => TITLE_LABEL_WORDS.has(t))) return true;
  if (/^©/.test(line) || /copyright/i.test(line)) return true;
  if (/doi\.org\/10\.\d/i.test(line) || /^10\.\d{4,9}\//.test(line) || /^doi[:\s]/i.test(line)) return true;
  if (/^https?:\/\//i.test(line)) return true;
  // Running header: "Sörman et al. BMC Medical Education (2025) 25:1690".
  if (/\(\d{4}\)\s*\d+\s*:/.test(line) && /\bet al\.?\b/i.test(line)) return true;
  if (/\b(19|20)\d{2}\b/.test(line) && /\bet al\.?\b/i.test(line) && line.split(/\s+/).length <= 10) return true;
  // Short journal-name line sitting directly above the DOI line.
  if (nextLine && /doi\.org\/10\.\d/i.test(nextLine) && line.split(/\s+/).length <= 6 && !/[.:;!?]$/.test(line)) return true;
  return false;
}

/**
 * Derive a title from extracted text when the PDF carries no Title metadata.
 * Skips journal headers, DOI lines, and article-type labels, then joins the
 * first substantial title-like lines. Returns '' when nothing looks like a
 * title, so the student can type one instead of getting a wrong guess.
 */
export function deriveTitleFromText(text: string): string {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 24);
  const titleLines: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!titleLines.length && isSkippableTitleLine(line, lines[i + 1] || '')) continue;
    if (!titleLines.length && line.split(/\s+/).length < 3) continue; // too short to start a title
    // Lines that end the title block: section headings, affiliation markers,
    // and author lists (which carry commas between names).
    if (/^(abstract|keywords?|background|introduction)\b/i.test(line)) break;
    if (/^[\d\s,.*†‡§]+$/.test(line)) break;
    if (titleLines.length && /,/.test(line)) break;
    titleLines.push(line);
    const joined = titleLines.join(' ');
    if (joined.length >= 200) break;
    if (titleLines.length >= 4) break;
  }
  const title = titleLines.join(' ').replace(/\s+/g, ' ').trim();
  if (title.split(/\s+/).length < 4 || title.length < 20) return '';
  return title.slice(0, 300);
}

/** Join page texts into one article text with a blank line between pages. */
export function assemblePdfText(pages: string[]): string {
  return pages
    .map((page) => page.trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  const [{ GlobalWorkerOptions, getDocument }, workerUrlModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrlModule.default;
  const data = await file.arrayBuffer();
  const loadingTask = getDocument({ data });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'PasswordException') {
      throw new Error('That PDF is password-protected. Open it, save an unprotected copy, and try that file instead.');
    }
    throw new Error('That file could not be read as a PDF. Choose a PDF of the article, or paste the article text instead.');
  }

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.filter((item): item is TextItem => 'str' in item);
      pages.push(assemblePageText(items));
    }

    let title = '';
    try {
      const metadata = await pdf.getMetadata();
      const infoTitle = (metadata.info as { Title?: unknown } | undefined)?.Title;
      if (typeof infoTitle === 'string') title = infoTitle.trim();
    } catch {
      // Metadata is a nicety only; the extracted text is what matters.
    }

    const text = assemblePdfText(pages);
    // Many publisher PDFs carry no Title metadata: derive one from the text.
    if (!title) title = deriveTitleFromText(text);
    return { text, pageCount: pdf.numPages, title };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}
