// Preloaded demo articles for intake. Both are open access (CC BY 4.0);
// the full citation and license note are also saved at the top of each
// text file in this folder. Picking a demo fills the same editable article
// box as paste and PDF upload, so the 500-character minimum and the map
// flow are unchanged. Texts are lazy-loaded so paste/PDF students do not
// download them up front.

export type DemoArticle = {
  id: string;
  kind: string;
  title: string;
  authors: string;
  doi: string;
  citation: string;
  license: string;
  sourceUrl: string;
};

export const DEMO_ARTICLES: DemoArticle[] = [
  {
    id: 'sorman-2025',
    kind: 'Quantitative — randomized controlled trial',
    title:
      'Virtual patient simulation strengthens confidence in clinical conversations among undergraduated nursing students: a randomized controlled trial',
    authors:
      'Sörman K, El Alaoui S, Mårtensson S, Larsson M, Knez R, Ljudvåg M, Mac R, Dahlström K, Nowak YE, Fors U, Eckerström J',
    doi: '10.1186/s12909-025-08413-y',
    citation:
      'Sörman et al. (2025). BMC Medical Education. DOI: 10.1186/s12909-025-08413-y. PMC12690956.',
    license: 'Open access under CC BY 4.0 (Creative Commons Attribution 4.0 International License).',
    sourceUrl: 'https://link.springer.com/article/10.1186/s12909-025-08413-y',
  },
  {
    id: 'zhang-2025',
    kind: 'Qualitative — phenomenological study',
    title: 'Epidemic-induced changes in nursing students’ professional identity: a qualitative investigation',
    authors: 'Zhang H, He W, Cao D, Liu J, Yang Y, Zhu X, Jiang M',
    doi: '10.3389/fpubh.2025.1565212',
    citation:
      'Zhang et al. (2025). Frontiers in Public Health, 13:1565212. DOI: 10.3389/fpubh.2025.1565212. PMC12081350.',
    license: 'Open access under CC BY 4.0 (Creative Commons Attribution License).',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12081350/',
  },
];

const DEMO_HEADER_MARKER = '\n---\n';

/** The saved files start with citation/license lines; the article box gets only the article text. */
export function stripDemoHeader(raw: string): string {
  const at = raw.indexOf(DEMO_HEADER_MARKER);
  return (at === -1 ? raw : raw.slice(at + DEMO_HEADER_MARKER.length)).trim();
}

export async function loadDemoArticleText(demo: DemoArticle): Promise<string> {
  const raw =
    demo.id === 'sorman-2025'
      ? (await import('./demoArticles/sorman-2025.txt?raw')).default
      : (await import('./demoArticles/zhang-2025.txt?raw')).default;
  return stripDemoHeader(raw);
}
