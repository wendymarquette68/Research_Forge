import { useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredAttempt,
} from './session';
import { buildCritiqueDocxBlob, critiqueFilename, downloadBlob } from './exportDoc';
import { extractPdfText } from './pdfText';
import { DEMO_ARTICLES, loadDemoArticleText, type DemoArticle } from './demoArticles';

type Health = { ok: boolean; model: string; baseUrl: string; hasKey: boolean; keyFingerprint?: string | null };

type MapArea = {
  id: string;
  label: string;
  summary: string;
  keyPoints: string[];
  quotes: string[];
};

type ArticleMap = {
  article: { title: string; authors: string };
  truncated: boolean;
  model: string;
  areas: MapArea[];
};

type MapResponse =
  | ({ ok: true } & ArticleMap)
  | { ok: false; error?: string; code?: string };

type Question = { id: string; label: string; question: string };

type Feedback = {
  rating: 'Emerging' | 'Developing' | 'Proficient';
  gotRight: string;
  conceptNote?: string;
  quoteRole?: string;
  quote: string | null;
  quoteReference: string | null;
  quoteVerified: boolean;
  quoteFlag: string | null;
  followUp: string;
};

type CritiqueResponse =
  | { ok: true; areaId: string; feedback: Feedback }
  | { ok: false; error?: string; code?: string };

type DoiResponse =
  | {
      ok: true;
      doi: string;
      title: string;
      authors: string;
      journal: string;
      year: string;
      fullText: string | null;
      openAccess: boolean;
    }
  | { ok: false; error?: string; code?: string };

type Attempt = StoredAttempt;

const FALLBACK_OVERALL: Question = {
  id: 'overall',
  label: 'Overall judgment',
  question:
    'How much should a reader trust this study, and how could it be used? Give your overall judgment of the article strength, drawing together what you found in the five areas.',
};

const MIN_CHARS = 500;
const MIN_WORDS = 15;

const FALLBACK_QUESTIONS: Question[] = [
  { id: 'research-question', label: 'Research question and background', question: 'In your own words, what question does this study set out to answer, and how well does the background justify why that question matters? Point to what the authors themselves say.' },
  { id: 'methods', label: 'Methods', question: 'How did the researchers carry out the study, and how well do those methods fit the question? Comment on who or what was studied, how the study was set up, and how data were collected.' },
  { id: 'evidence', label: 'Evidence', question: 'What evidence did the study gather, and how complete or trustworthy does that evidence look to you? Consider who took part, how many, and what was actually measured.' },
  { id: 'findings', label: 'Findings', question: 'What did the study find, and how clearly do those findings answer the research question? Stick to what the authors report, not what you expected.' },
  { id: 'limitations', label: 'Limitations and applicability', question: 'What are the main limitations of this study, and how far can its findings be applied beyond the people and setting studied? Use limits the article supports, including any the authors name themselves.' },
];

function countWords(s: string) {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

function quoteRoleLabel(quoteRole?: string): string {
  if (quoteRole === 'supports') return 'From the article — this passage supports your answer';
  if (quoteRole === 'challenges') return 'From the article — this passage challenges your answer';
  return 'From the article — the passage your answer connects to';
}

const RATING_STYLE: Record<Feedback['rating'], string> = {
  Emerging: 'border-amber-700 bg-amber-50 text-amber-900',
  Developing: 'border-sky-800 bg-sky-50 text-sky-900',
  Proficient: 'border-emerald-700 bg-emerald-50 text-emerald-900',
};

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState('');
  const [questions, setQuestions] = useState<Question[]>(FALLBACK_QUESTIONS);
  const [overallQuestion, setOverallQuestion] = useState<Question>(FALLBACK_OVERALL);

  // Restored once on load: a page reload keeps the student's work.
  const [restored] = useState(loadSession);

  const [title, setTitle] = useState(restored?.title ?? '');
  const [authors, setAuthors] = useState(restored?.authors ?? '');
  const [doi, setDoi] = useState(restored?.doi ?? '');
  const [text, setText] = useState(restored?.text ?? '');

  // The map is the hidden judging reference. It is held in state and sent
  // back per question, but it is never shown to the learner during the loop.
  const [map, setMap] = useState<ArticleMap | null>(restored?.map ?? null);
  const [stage, setStage] = useState<'intake' | 'loop' | 'summary'>(restored?.stage ?? 'intake');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [current, setCurrent] = useState(restored?.current ?? 0);
  const [attempts, setAttempts] = useState<Attempt[][]>(restored?.attempts ?? []);
  const [draft, setDraft] = useState(restored?.draft ?? '');
  const [revising, setRevising] = useState(false);
  const [overall, setOverall] = useState<Attempt | null>(restored?.overall ?? null);
  const [overallDraft, setOverallDraft] = useState(restored?.overallDraft ?? '');
  const [downloading, setDownloading] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoNote, setDemoNote] = useState('');
  const [doiBusy, setDoiBusy] = useState(false);
  const [doiNote, setDoiNote] = useState('');
  const [doiFailed, setDoiFailed] = useState(false);

  function focusElement(id: string) {
    window.setTimeout(() => document.getElementById(id)?.focus(), 50);
  }

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealthError('Back end not reachable. Start it with npm run dev:server.'));
    fetch('/api/questions')
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.questions) && d.questions.length === 5) setQuestions(d.questions);
        if (d?.ok && d.overall?.question) setOverallQuestion(d.overall);
      })
      .catch(() => { /* fallback questions above */ });
  }, []);

  // Persist the whole session so a reload never wipes the student's work.
  useEffect(() => {
    if (!map && !text.trim() && !attempts.length && !overall) {
      clearSession();
      return;
    }
    saveSession({
      version: 1,
      title,
      authors,
      doi,
      text,
      map,
      stage,
      current,
      attempts,
      overall,
      draft,
      overallDraft,
    });
  }, [title, authors, doi, text, map, stage, current, attempts, overall, draft, overallDraft]);

  const charCount = text.trim().length;
  const pasteWordCount = useMemo(() => countWords(text), [text]);
  const draftWords = useMemo(() => countWords(draft), [draft]);
  const canBuild = !busy && !pdfBusy && !demoBusy && !doiBusy && charCount >= MIN_CHARS;

  const question = questions[current];
  const currentAttempts = attempts[current] ?? [];
  const latestFeedback = currentAttempts.length ? currentAttempts[currentAttempts.length - 1].feedback : null;
  const canRevise = currentAttempts.length === 1 && !revising;
  const showAnswerBox = currentAttempts.length === 0 || revising;

  async function onPdfSelected(file: File | undefined) {
    if (!file) return;
    setPdfBusy(true);
    setError('');
    setPdfNote('');
    setDemoNote('');
    try {
      // The file is read here in the browser. It is never uploaded or stored.
      const extracted = await extractPdfText(file);
      if (!extracted.text) {
        setError('No readable text was found in that PDF. It may be a scanned or image-only PDF. Paste the article text instead, or use a text-based PDF.');
        focusElement('intake-error');
        return;
      }
      setText(extracted.text);
      if (extracted.title && !title.trim()) setTitle(extracted.title);
      setPdfNote(
        `Read “${file.name}” in your browser (${extracted.pageCount} page${extracted.pageCount === 1 ? '' : 's'}, ${extracted.text.length.toLocaleString()} characters). The PDF was not uploaded or stored. Check the text below, fix anything that looks wrong, then start the critique.`,
      );
      setAnnouncement(`PDF read in your browser. ${extracted.text.length.toLocaleString()} characters extracted. Check the article text, then start the critique.`);
      // The file input disables while reading; put focus on the extracted text.
      focusElement('article-text');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That PDF could not be read. Paste the article text instead.');
      focusElement('intake-error');
    } finally {
      setPdfBusy(false);
    }
  }

  async function loadDemo(demo: DemoArticle) {
    setDemoBusy(true);
    setError('');
    setPdfNote('');
    try {
      const articleText = await loadDemoArticleText(demo);
      setTitle(demo.title);
      setAuthors(demo.authors);
      setDoi(demo.doi);
      setDoiNote('');
      setDoiFailed(false);
      setText(articleText);
      setDemoNote(
        `Loaded demo article: ${demo.citation} ${demo.license} The text (${articleText.length.toLocaleString()} characters, from the Abstract through the Discussion) is in the box below — you can edit it before starting.`,
      );
      setAnnouncement(`Demo article loaded. ${demo.title}. Check the article text, then start the critique.`);
      // The Load button disables while loading; put focus on the loaded text.
      focusElement('article-text');
    } catch {
      setError('That demo article could not be loaded. Paste the article text or upload its PDF instead.');
      focusElement('intake-error');
    } finally {
      setDemoBusy(false);
    }
  }

  async function lookupDoi() {
    const rawDoi = doi.trim();
    if (!rawDoi || doiBusy) return;
    setDoiBusy(true);
    setDoiNote('');
    setDoiFailed(false);
    setError('');
    try {
      const r = await fetch(`/api/doi-article?doi=${encodeURIComponent(rawDoi)}`);
      const data: DoiResponse = await r.json();
      if (!data.ok) {
        setDoiFailed(true);
        setDoiNote(data.error || 'That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');
        focusElement('doi-message');
        return;
      }
      setDoi(data.doi);
      if (data.title) setTitle(data.title);
      if (data.authors) setAuthors(data.authors);
      const source = [data.journal, data.year].filter(Boolean).join(', ');
      if (data.openAccess && data.fullText) {
        setText(data.fullText);
        setPdfNote('');
        setDemoNote('');
        setDoiNote(
          `Loaded from DOI ${data.doi}${source ? ` (${source})` : ''}: ${data.fullText.length.toLocaleString()} characters from the Abstract through the Discussion are in the box below. The text is editable — check it, then start the critique.`,
        );
        setAnnouncement(`Article loaded from its DOI. ${data.fullText.length.toLocaleString()} characters are in the article box. Check the text, then start the critique.`);
        focusElement('article-text');
      } else {
        // Not freely available is not a failure: keep whatever metadata came back.
        setDoiNote('This article is not freely available, so the text could not be pulled in. Paste the text or upload the PDF instead.');
        setAnnouncement('That article is not freely available, so its text could not be pulled in. Paste the text or upload the PDF instead.');
        focusElement('doi-message');
      }
    } catch {
      setDoiFailed(true);
      setDoiNote('That DOI could not be looked up. Check it and try again, or paste the text or upload the PDF instead.');
      focusElement('doi-message');
    } finally {
      setDoiBusy(false);
    }
  }

  async function buildMap() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/article-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, authors, text }),
      });
      const data: MapResponse = await r.json();
      if (!data.ok) {
        setError(data.error || 'Could not build the article map. Please try again.');
        focusElement('intake-error');
        return;
      }
      const built: ArticleMap = { article: data.article, truncated: data.truncated, model: data.model, areas: data.areas };
      setMap(built);
      setAttempts(built.areas.map(() => []));
      setCurrent(0);
      setDraft('');
      setRevising(false);
      setStage('loop');
      setAnnouncement('Your article is mapped. Question 1 of 5: Research question and background.');
      focusElement('loop-heading');
    } catch {
      setError('Back end not reachable. Start it with npm run dev:server, then try again.');
      focusElement('intake-error');
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!map || !question) return;
    setBusy(true);
    setError('');
    try {
      const mapArea = map.areas.find((a) => a.id === question.id) ?? null;
      const r = await fetch('/api/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: map.article.title,
          articleText: text,
          areaId: question.id,
          mapArea,
          answer: draft,
        }),
      });
      const data: CritiqueResponse = await r.json();
      if (!data.ok) {
        setError(data.error || 'The coach could not respond. Please try again.');
        focusElement('critique-error');
        return;
      }
      const feedbackIndex = currentAttempts.length;
      setAttempts((prev) => {
        const next = prev.map((list) => [...list]);
        next[current] = [...(next[current] ?? []), { answer: draft, feedback: data.feedback }];
        return next;
      });
      setRevising(false);
      setAnnouncement(`Coach feedback received for question ${current + 1}. Rating: ${data.feedback.rating}.`);
      focusElement(`attempt-${feedbackIndex}`);
    } catch {
      setError('Back end not reachable. Start it with npm run dev:server, then try again.');
      focusElement('critique-error');
    } finally {
      setBusy(false);
    }
  }

  function startRevision() {
    setDraft(currentAttempts[0]?.answer ?? '');
    setRevising(true);
    setError('');
    setAnnouncement('Revise your answer. You have one revision for this question.');
    focusElement('answer-text');
  }

  function goToQuestion(i: number) {
    // Backtracking is only to questions already answered (or the current one).
    // The one-revision rule is unchanged: canRevise still requires exactly
    // one attempt, so a question already revised cannot be revised again.
    if (i === current && stage === 'loop') return;
    if (!(attempts[i] ?? []).length) return;
    setError('');
    setDraft('');
    setRevising(false);
    setCurrent(i);
    setStage('loop');
    setAnnouncement(`Back to question ${i + 1} of ${questions.length}: ${questions[i]?.label}. Your earlier answer and feedback are shown; you can revise it if you have not used your revision yet.`);
    focusElement('loop-heading');
  }

  function nextQuestion() {
    setError('');
    setDraft('');
    setRevising(false);
    if (current >= questions.length - 1) {
      setStage('summary');
      setAnnouncement('All five questions are complete. Your critique summary is ready. Write your overall judgment to finish.');
      focusElement('summary-heading');
    } else {
      const next = current + 1;
      setCurrent(next);
      setAnnouncement(`Question ${next + 1} of ${questions.length}: ${questions[next]?.label}.`);
      focusElement('loop-heading');
    }
  }

  const overallWords = useMemo(() => countWords(overallDraft), [overallDraft]);

  async function submitOverall() {
    if (!map) return;
    setBusy(true);
    setError('');
    try {
      const priorRatings = questions.map((q, i) => {
        const list = attempts[i] ?? [];
        return list.length ? { label: q.label, rating: list[list.length - 1].feedback.rating } : null;
      }).filter(Boolean) as { label: string; rating: string }[];
      const r = await fetch('/api/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: map.article.title,
          articleText: text,
          areaId: 'overall',
          mapArea: null,
          answer: overallDraft,
          priorRatings,
        }),
      });
      const data: CritiqueResponse = await r.json();
      if (!data.ok) {
        setError(data.error || 'The coach could not respond. Please try again.');
        focusElement('overall-error');
        return;
      }
      setOverall({ answer: overallDraft, feedback: data.feedback });
      setAnnouncement(`Overall judgment rated ${data.feedback.rating}. You can now download the Word document.`);
      focusElement('overall-feedback');
    } catch {
      setError('Back end not reachable. Start it with npm run dev:server, then try again.');
      focusElement('overall-error');
    } finally {
      setBusy(false);
    }
  }

  async function downloadWord() {
    if (!map) return;
    setDownloading(true);
    setError('');
    setAnnouncement('Building your Word document.');
    try {
      const blob = await buildCritiqueDocxBlob({
        articleTitle: map.article.title,
        articleAuthors: map.article.authors,
        articleDoi: doi,
        questions: questions.map((q, i) => ({
          label: q.label,
          question: q.question,
          attempts: attempts[i] ?? [],
        })),
        overall,
        overallQuestion: overallQuestion.question,
      });
      downloadBlob(blob, critiqueFilename(map.article.title));
      setAnnouncement('Word document downloaded.');
    } catch {
      setError('The Word document could not be built. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  function startAgain() {
    clearSession();
    setMap(null);
    setStage('intake');
    setAttempts([]);
    setCurrent(0);
    setDraft('');
    setRevising(false);
    setError('');
    setTitle('');
    setAuthors('');
    setDoi('');
    setText('');
    setOverall(null);
    setOverallDraft('');
    setPdfNote('');
    setDemoNote('');
    setDoiNote('');
    setDoiFailed(false);
    setAnnouncement('Start a new critique. Bring in one article.');
    focusElement('intake-heading');
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <a
        href="#main-content"
        className="font-ui sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-stone-900 focus:underline"
      >
        Skip to main content
      </a>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-2 px-5 py-4">
          <h1 className="text-xl font-bold tracking-tight">ResearchForge AI</h1>
          <span className="font-ui text-xs text-stone-700">
            Phase 4 — summary and export
          </span>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-5 py-8">
        <p className="max-w-2xl text-[17px] leading-relaxed">
          ResearchForge coaches you to judge a scholarly article&apos;s strength. It does
          not summarise it for you, and it never writes your answer. You will work through
          five questions about one article. For each one, write your judgment, read the
          coach&apos;s response, and revise once if you want to.
        </p>

        <p className="font-ui mt-3 text-xs text-stone-700" role="status">
          {healthError && <span className="text-red-800">{healthError}</span>}
          {health && (
            <span>
              Back end reachable · Model {health.model} (standard) · API key on server:{' '}
              {health.hasKey ? `present (value never shown${health.keyFingerprint ? `, fingerprint ${health.keyFingerprint}` : ''})` : 'not set yet — add it to server/.env'}
            </span>
          )}
          {!health && !healthError && <span>Checking connection…</span>}
        </p>

        {stage === 'intake' && (
          <section className="mt-6 border border-stone-300 bg-white p-5" aria-labelledby="intake-heading">
            <h2 id="intake-heading" tabIndex={-1} className="font-ui text-sm font-semibold">
              1. Bring in one article
            </h2>
            <p className="font-ui mt-1 text-sm text-stone-600">
              Paste the full text of one real scholarly article, upload its PDF below,
              load it by DOI, or start with a demo article. The app first maps the article, then asks you five
              questions about it. You will not see the map — it is the reference your
              answers are judged against.
            </p>

            <label className="font-ui mt-5 block text-sm font-medium" htmlFor="article-doi">
              DOI <span className="font-normal text-stone-700">(optional — paste a DOI to load the article)</span>
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                id="article-doi"
                type="text"
                value={doi}
                onChange={(e) => { setDoi(e.target.value); setDoiFailed(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void lookupDoi();
                  }
                }}
                placeholder="e.g. 10.1186/s12909-025-08413-y or https://doi.org/10.1186/s12909-025-08413-y"
                aria-describedby={doiNote ? 'doi-hint doi-message' : 'doi-hint'}
                aria-invalid={doiFailed ? true : undefined}
                className="font-ui min-w-64 flex-1 border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-600"
              />
              <button
                onClick={() => void lookupDoi()}
                disabled={doiBusy || !doi.trim()}
                aria-describedby="doi-hint"
                className="font-ui border border-stone-900 bg-white px-3 py-2 text-sm font-medium text-stone-900 disabled:opacity-50"
              >
                {doiBusy ? 'Looking up…' : 'Load article by DOI'}
              </button>
            </div>
            <p id="doi-hint" className="font-ui mt-1 text-xs leading-relaxed text-stone-700">
              If the article is freely available, its text loads into the box below and the
              title and authors fill in. If it is not freely available, paste the text or
              upload the PDF instead — a DOI lookup never blocks you.
            </p>
            {doiNote && (
              <p id="doi-message" tabIndex={-1} role="status" className="font-ui mt-2 text-sm leading-relaxed text-stone-800">
                {doiNote}
              </p>
            )}

            <div className="mt-5">
              <h3 className="font-ui text-sm font-medium">Or start with a demo article</h3>
              <p className="font-ui mt-1 text-xs leading-relaxed text-stone-700">
                Two open-access articles are preloaded. Pick one and its text fills the box
                below, where you can edit it before starting.
              </p>
              <ul className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
                {DEMO_ARTICLES.map((demo) => (
                  <li key={demo.id} className="py-3">
                    <p className="font-ui text-xs font-semibold text-stone-700">{demo.kind}</p>
                    <p className="mt-1 text-[15px] leading-relaxed">{demo.title}</p>
                    <p className="font-ui mt-1 text-xs leading-relaxed text-stone-700">
                      {demo.citation} {demo.license}{' '}
                      <a
                        href={demo.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        View source
                      </a>
                    </p>
                    <button
                      onClick={() => void loadDemo(demo)}
                      disabled={busy || pdfBusy || demoBusy}
                      className="font-ui mt-2 border border-stone-900 bg-white px-3 py-1.5 text-sm font-medium text-stone-900 disabled:opacity-50"
                    >
                      {demoBusy ? 'Loading…' : 'Load this article'}
                    </button>
                  </li>
                ))}
              </ul>
              {demoNote && (
                <p className="font-ui mt-2 text-sm leading-relaxed text-stone-800" role="status">
                  {demoNote}
                </p>
              )}
            </div>

            <label className="font-ui mt-5 block text-sm font-medium" htmlFor="article-title">
              Article title
            </label>
            <input
              id="article-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Effects of a walking programme on blood pressure in older adults"
              className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-600"
            />

            <label className="font-ui mt-4 block text-sm font-medium" htmlFor="article-authors">
              Authors <span className="font-normal text-stone-700">(optional)</span>
            </label>
            <input
              id="article-authors"
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="e.g. Smith J, Doe A, Lee K"
              className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-600"
            />

            <div className="mt-5 border border-stone-300 bg-stone-50 p-4">
              <label className="font-ui block text-sm font-medium" htmlFor="article-pdf">
                Or upload the article as a PDF
              </label>
              <input
                id="article-pdf"
                type="file"
                accept="application/pdf,.pdf"
                disabled={busy || pdfBusy}
                aria-describedby="article-pdf-hint"
                onChange={(e) => {
                  void onPdfSelected(e.target.files?.[0]);
                  e.target.value = '';
                }}
                className="font-ui mt-2 block w-full text-sm text-stone-700 disabled:opacity-50"
              />
              <p id="article-pdf-hint" className="font-ui mt-2 text-xs leading-relaxed text-stone-700">
                The PDF is read in your browser only. The file is not uploaded to or stored
                on a server. Its text appears in the box below, where you can check and fix
                it before starting. Scanned or image-only PDFs have no text to read — paste
                the text for those instead.
              </p>
              {pdfBusy && (
                <p className="font-ui mt-2 text-sm text-stone-700" role="status">
                  Reading the PDF in your browser…
                </p>
              )}
              {pdfNote && (
                <p className="font-ui mt-2 text-sm text-stone-800" role="status">
                  {pdfNote}
                </p>
              )}
            </div>

            <label className="font-ui mt-4 block text-sm font-medium" htmlFor="article-text">
              Full article text
            </label>
            <textarea
              id="article-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder="Paste the article text here…"
              aria-describedby={error ? 'article-text-hint intake-error' : 'article-text-hint'}
              aria-invalid={error ? true : undefined}
              className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm leading-relaxed placeholder:text-stone-600"
            />
            <p id="article-text-hint" className="font-ui mt-1 text-xs text-stone-700">
              {charCount.toLocaleString()} characters · {pasteWordCount.toLocaleString()} words
              {charCount < MIN_CHARS && (
                <span> · paste at least {MIN_CHARS} characters to start</span>
              )}
            </p>

            {error && (
              <div id="intake-error" tabIndex={-1} className="font-ui mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
                {error}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={buildMap}
                disabled={!canBuild}
                aria-describedby="article-text-hint"
                className="font-ui bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Reading the article…' : 'Start the critique'}
              </button>
            </div>
            {busy && (
              <p className="font-ui mt-3 text-sm text-stone-600">
                Mapping the article into its five areas. This can take a short while.
              </p>
            )}
          </section>
        )}

        {stage === 'loop' && map && question && (
          <section className="mt-6" aria-labelledby="loop-heading">
            <div className="border border-stone-300 bg-white p-5">
              <p className="font-ui text-xs text-stone-700">
                {map.article.title}
                {map.article.authors ? ` — ${map.article.authors}` : ''}
              </p>
              <h2 id="loop-heading" tabIndex={-1} className="font-ui mt-2 text-sm font-semibold">
                Question {current + 1} of {questions.length} — {question.label}
              </h2>
              <ol className="font-ui mt-3 flex flex-wrap gap-2" aria-label="Progress — select a finished question to go back to it">
                {questions.map((q, i) => {
                  const done = (attempts[i] ?? []).length > 0;
                  const rating = done ? attempts[i][attempts[i].length - 1].feedback.rating : null;
                  const chipText = `${i + 1}. ${q.label}${rating ? ` · ${rating}` : ''}`;
                  return (
                    <li
                      key={q.id}
                      aria-current={i === current ? 'step' : undefined}
                      className={`border text-xs ${i === current ? 'border-stone-900 bg-stone-900 text-white' : done ? 'border-stone-300 bg-stone-50 text-stone-700' : 'border-stone-300 bg-white text-stone-700'}`}
                    >
                      {done && i !== current ? (
                        <button
                          onClick={() => goToQuestion(i)}
                          disabled={busy}
                          aria-label={`Go back to question ${i + 1}: ${q.label}`}
                          className="px-2 py-1 underline disabled:opacity-50"
                        >
                          {chipText}
                        </button>
                      ) : (
                        <span className="block px-2 py-1">{chipText}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="font-ui mt-2 text-xs text-stone-700">
                You can go back to any finished question from the list above and revise it, if you have not used that question&apos;s revision yet.
              </p>
              <p className="mt-4 text-[17px] leading-relaxed">{question.question}</p>
              <p className="font-ui mt-2 text-xs text-stone-700">
                Write at least {MIN_WORDS} words. You get one revision after the coach responds.
              </p>
            </div>

            {currentAttempts.map((attempt, i) => (
              <div key={i} id={`attempt-${i}`} tabIndex={-1} className="mt-4 border border-stone-300 bg-white p-5">
                <h3 className="font-ui text-xs font-semibold text-stone-700">
                  {i === 0 ? 'Your answer' : 'Your revision'}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed">{attempt.answer}</p>
                <div
                  className={`font-ui mt-4 inline-block border px-2 py-1 text-xs font-semibold ${RATING_STYLE[attempt.feedback.rating as Feedback['rating']] ?? RATING_STYLE.Developing}`}
                >
                  {attempt.feedback.rating}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed">
                  <span className="font-ui text-sm font-semibold">What you got right: </span>
                  {attempt.feedback.gotRight}
                </p>
                {attempt.feedback.quoteVerified && attempt.feedback.quote ? (
                  <figure className="mt-4">
                    <p className="font-ui mb-1 text-xs font-semibold text-stone-700">
                      {quoteRoleLabel(attempt.feedback.quoteRole)}
                    </p>
                    <blockquote className="border-l-2 border-stone-400 bg-stone-50 py-2 pl-3 pr-2 text-[15px] leading-relaxed">
                      “{attempt.feedback.quote}”
                    </blockquote>
                    <figcaption className="font-ui mt-1 text-xs text-stone-700">
                      {attempt.feedback.quoteReference} · verified word for word in your pasted article
                    </figcaption>
                  </figure>
                ) : (
                  <p className="font-ui mt-4 border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                    {attempt.feedback.quoteFlag || 'No verified quote was available for this feedback.'}
                  </p>
                )}
                {attempt.feedback.conceptNote && attempt.feedback.rating !== 'Proficient' && (
                  <p className="mt-4 text-[15px] leading-relaxed">
                    <span className="font-ui text-sm font-semibold">Key idea: </span>
                    {attempt.feedback.conceptNote}
                  </p>
                )}
                <p className="mt-4 text-[15px] leading-relaxed">
                  <span className="font-ui text-sm font-semibold">Think about this: </span>
                  {attempt.feedback.followUp}
                </p>
              </div>
            ))}

            {error && (
              <div id="critique-error" tabIndex={-1} className="font-ui mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
                {error}
              </div>
            )}

            {showAnswerBox && (
              <div className="mt-4 border border-stone-300 bg-white p-5">
                <label className="font-ui block text-sm font-medium" htmlFor="answer-text">
                  {revising ? 'Revise your answer' : 'Your answer'}
                </label>
                <textarea
                  id="answer-text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={7}
                  placeholder="Write your judgment in your own words…"
                  aria-describedby={error ? 'answer-hint critique-error' : 'answer-hint'}
                  aria-invalid={error ? true : undefined}
                  className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm leading-relaxed placeholder:text-stone-600"
                />
                <p id="answer-hint" className="font-ui mt-1 text-xs text-stone-700">
                  {draftWords} word{draftWords === 1 ? '' : 's'}
                  {draftWords < MIN_WORDS && <span> · at least {MIN_WORDS} words needed</span>}
                </p>
                <button
                  onClick={submitAnswer}
                  disabled={busy || draftWords < MIN_WORDS}
                  aria-describedby="answer-hint"
                  className="font-ui mt-4 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? 'Coach is reading…' : revising ? 'Submit revision' : 'Submit answer'}
                </button>
                {revising && (
                  <button
                    onClick={() => {
                      setRevising(false);
                      setError('');
                      // This button unmounts with the revision box; send focus to the kept feedback.
                      focusElement(`attempt-${currentAttempts.length - 1}`);
                    }}
                    disabled={busy}
                    className="font-ui ml-3 border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
                  >
                    Keep my first answer
                  </button>
                )}
              </div>
            )}

            {!showAnswerBox && latestFeedback && (
              <div className="mt-4 flex flex-wrap gap-3">
                {canRevise && (
                  <button
                    onClick={startRevision}
                    disabled={busy}
                    className="font-ui border border-stone-900 bg-white px-4 py-2 text-sm font-medium text-stone-900 disabled:opacity-50"
                  >
                    Revise once
                  </button>
                )}
                <button
                  onClick={nextQuestion}
                  disabled={busy}
                  className="font-ui bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {current >= questions.length - 1 ? 'Finish' : 'Next question'}
                </button>
              </div>
            )}
          </section>
        )}

        {stage === 'summary' && map && (
          <section className="mt-6 border border-stone-300 bg-white p-5" aria-labelledby="summary-heading">
            <h2 id="summary-heading" tabIndex={-1} className="font-ui text-sm font-semibold">
              Critique summary
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              “{map.article.title}”
              {map.article.authors ? ` — ${map.article.authors}` : ''}
            </p>
            {doi && (
              <p className="font-ui mt-1 text-xs text-stone-700">
                DOI: {doi} · <a href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer" className="underline">https://doi.org/{doi}</a>
              </p>
            )}

            <div className="font-ui mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  Coach ratings for the five critique questions, first answer and revision side by side
                </caption>
                <thead>
                  <tr className="border-b border-stone-300 text-stone-700">
                    <th scope="col" className="py-2 pr-3 font-medium">Question</th>
                    <th scope="col" className="py-2 pr-3 font-medium">First rating</th>
                    <th scope="col" className="py-2 font-medium">Revised rating</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => {
                    const list = attempts[i] ?? [];
                    const first = list[0]?.feedback.rating;
                    const revised = list[1]?.feedback.rating;
                    return (
                      <tr key={q.id} className="border-b border-stone-200">
                        <td className="py-2 pr-3">{i + 1}. {q.label}</td>
                        <td className="py-2 pr-3">
                          {first ? (
                            <span className={`border px-2 py-0.5 text-xs font-semibold ${RATING_STYLE[first as Feedback['rating']]}`}>{first}</span>
                          ) : '—'}
                        </td>
                        <td className="py-2">
                          {revised ? (
                            <span className={`border px-2 py-0.5 text-xs font-semibold ${RATING_STYLE[revised as Feedback['rating']]}`}>{revised}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <p className="font-ui text-xs text-stone-700">
                Want to change an earlier answer? Go back to that question — the summary and Word document will use your latest answers.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {questions.map((q, i) => (
                  (attempts[i] ?? []).length > 0 ? (
                    <button
                      key={q.id}
                      onClick={() => goToQuestion(i)}
                      disabled={busy}
                      className="font-ui border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 disabled:opacity-50"
                    >
                      Back to Q{i + 1}: {q.label}
                    </button>
                  ) : null
                ))}
              </div>
            </div>

            <h3 className="font-ui mt-6 text-sm font-semibold">Overall judgment</h3>
            <p className="mt-2 text-[15px] leading-relaxed">{overallQuestion.question}</p>

            {!overall && (
              <div className="mt-3">
                <label className="font-ui block text-sm font-medium" htmlFor="overall-text">
                  Your overall judgment
                </label>
                <textarea
                  id="overall-text"
                  value={overallDraft}
                  onChange={(e) => setOverallDraft(e.target.value)}
                  rows={6}
                  placeholder="How much should a reader trust this study, and how could it be used?"
                  aria-describedby={error ? 'overall-hint overall-error' : 'overall-hint'}
                  aria-invalid={error ? true : undefined}
                  className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm leading-relaxed placeholder:text-stone-600"
                />
                <p id="overall-hint" className="font-ui mt-1 text-xs text-stone-700">
                  {overallWords} word{overallWords === 1 ? '' : 's'}
                  {overallWords < MIN_WORDS && <span> · at least {MIN_WORDS} words needed</span>}
                </p>
                {error && (
                  <div id="overall-error" tabIndex={-1} className="font-ui mt-3 border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
                    {error}
                  </div>
                )}
                <button
                  onClick={submitOverall}
                  disabled={busy || overallWords < MIN_WORDS}
                  aria-describedby="overall-hint"
                  className="font-ui mt-4 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? 'Coach is reading…' : 'Submit overall judgment'}
                </button>
              </div>
            )}

            {overall && (
              <div id="overall-feedback" tabIndex={-1} className="mt-3 border-t border-stone-200 pt-4">
                <p className="text-[15px] leading-relaxed">{overall.answer}</p>
                <div className={`font-ui mt-3 inline-block border px-2 py-1 text-xs font-semibold ${RATING_STYLE[overall.feedback.rating as Feedback['rating']]}`}>
                  {overall.feedback.rating}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed">
                  <span className="font-ui text-sm font-semibold">What you got right: </span>
                  {overall.feedback.gotRight}
                </p>
                {overall.feedback.quoteVerified && overall.feedback.quote ? (
                  <figure className="mt-4">
                    <p className="font-ui mb-1 text-xs font-semibold text-stone-700">
                      {quoteRoleLabel(overall.feedback.quoteRole)}
                    </p>
                    <blockquote className="border-l-2 border-stone-400 bg-stone-50 py-2 pl-3 pr-2 text-[15px] leading-relaxed">
                      “{overall.feedback.quote}”
                    </blockquote>
                    <figcaption className="font-ui mt-1 text-xs text-stone-700">
                      {overall.feedback.quoteReference} · verified word for word in your pasted article
                    </figcaption>
                  </figure>
                ) : (
                  <p className="font-ui mt-4 border border-amber-700 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                    {overall.feedback.quoteFlag || 'No verified quote was available for this feedback.'}
                  </p>
                )}
                {overall.feedback.conceptNote && overall.feedback.rating !== 'Proficient' && (
                  <p className="mt-4 text-[15px] leading-relaxed">
                    <span className="font-ui text-sm font-semibold">Key idea: </span>
                    {overall.feedback.conceptNote}
                  </p>
                )}
              </div>
            )}

            {error && overall && (
              <div className="font-ui mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={downloadWord}
                disabled={!overall || downloading}
                className="font-ui bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {downloading ? 'Building document…' : 'Download Word document'}
              </button>
              <button
                onClick={startAgain}
                className="font-ui border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700"
              >
                Critique another article
              </button>
            </div>
            {!overall && (
              <p className="font-ui mt-2 text-xs text-stone-700">
                Submit your overall judgment first — the Word document includes it.
              </p>
            )}
            <p className="font-ui mt-3 text-xs text-stone-700">
              Your work is saved in this browser as you go. Reloading the page will not wipe it.
            </p>
          </section>
        )}

        <p className="font-ui mt-8 text-xs leading-relaxed text-stone-700">
          The article, its hidden map, and your answers are saved only in this browser
          (localStorage), so a reload keeps your work. Nothing is saved on a server.
          The API key lives only in <code>server/.env</code>
          {' '}on the back end and never appears in this front end.
        </p>
      </main>
    </div>
  );
}
