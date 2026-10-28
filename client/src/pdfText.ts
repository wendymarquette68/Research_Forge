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

type TextItemLike = { str: string; hasEOL?: boolean };

/** Join one page's text items, keeping the line breaks pdf.js reports. */
export function assemblePageText(items: TextItemLike[]): string {
  let out = '';
  for (const item of items) {
    if (!item.str) continue;
    out += item.str;
    out += item.hasEOL ? '\n' : ' ';
  }
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
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

    return { text: assemblePdfText(pages), pageCount: pdf.numPages, title };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}
