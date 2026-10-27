import { useEffect, useMemo, useState } from 'react';

type Health = { ok: boolean; model: string; baseUrl: string; hasKey: boolean };

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

const MIN_CHARS = 500;

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState('');

  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [text, setText] = useState('');

  const [map, setMap] = useState<ArticleMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealthError('Back end not reachable. Start it with npm run dev:server.'));
  }, []);

  const charCount = text.trim().length;
  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );
  const canSubmit = !busy && charCount >= MIN_CHARS;

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
        return;
      }
      setMap({ article: data.article, truncated: data.truncated, model: data.model, areas: data.areas });
    } catch {
      setError('Back end not reachable. Start it with npm run dev:server, then try again.');
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    setTitle('');
    setAuthors('');
    setText('');
    setMap(null);
    setError('');
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-2 px-5 py-4">
          <h1 className="text-xl font-bold tracking-tight">ResearchForge AI</h1>
          <span className="font-ui text-xs text-stone-500">
            Phase 2 — article intake and article map
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <p className="max-w-2xl text-[17px] leading-relaxed">
          ResearchForge coaches you to judge a scholarly article&apos;s strength. It does
          not summarise it for you. Paste one article below and the app will map it into
          the five areas you will appraise. Coaching comes in a later step — this step
          only builds the map.
        </p>

        <p className="font-ui mt-3 text-xs text-stone-500" role="status">
          {healthError && <span className="text-red-800">{healthError}</span>}
          {health && (
            <span>
              Back end reachable · Model {health.model} (standard) · API key on server:{' '}
              {health.hasKey ? 'present (value never shown)' : 'not set yet — add it to server/.env'}
            </span>
          )}
          {!health && !healthError && <span>Checking connection…</span>}
        </p>

        <section className="mt-6 border border-stone-300 bg-white p-5" aria-labelledby="intake-heading">
          <h2 id="intake-heading" className="font-ui text-sm font-semibold">
            1. Bring in one article
          </h2>
          <p className="font-ui mt-1 text-sm text-stone-600">
            Paste the full text of one real scholarly article. Include the abstract,
            headings, and references if you have them — a fuller text makes a better map.
          </p>

          <label className="font-ui mt-5 block text-sm font-medium" htmlFor="article-title">
            Article title
          </label>
          <input
            id="article-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Effects of a walking programme on blood pressure in older adults"
            className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm"
          />

          <label className="font-ui mt-4 block text-sm font-medium" htmlFor="article-authors">
            Authors <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            id="article-authors"
            type="text"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="e.g. Smith J, Doe A, Lee K"
            className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm"
          />

          <label className="font-ui mt-4 block text-sm font-medium" htmlFor="article-text">
            Full article text
          </label>
          <textarea
            id="article-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder="Paste the article text here…"
            className="font-ui mt-1 w-full border border-stone-300 px-3 py-2 text-sm leading-relaxed"
          />
          <p className="font-ui mt-1 text-xs text-stone-500">
            {charCount.toLocaleString()} characters · {wordCount.toLocaleString()} words
            {charCount < MIN_CHARS && (
              <span> · paste at least {MIN_CHARS} characters to build the map</span>
            )}
          </p>

          {error && (
            <div className="font-ui mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={buildMap}
              disabled={!canSubmit}
              className="font-ui bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Building map…' : 'Build article map'}
            </button>
            <button
              onClick={clearAll}
              disabled={busy && !map}
              className="font-ui border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          {busy && (
            <p className="font-ui mt-3 text-sm text-stone-600">
              Reading the article and mapping its five areas. This can take a short while.
            </p>
          )}
        </section>

        {map && (
          <section className="mt-8" aria-labelledby="map-heading">
            <h2 id="map-heading" className="font-ui text-sm font-semibold">
              2. Article map
            </h2>
            <div className="mt-3 border border-stone-300 bg-white p-5">
              <h3 className="text-lg font-bold leading-snug">{map.article.title}</h3>
              {map.article.authors && (
                <p className="font-ui mt-1 text-sm text-stone-600">{map.article.authors}</p>
              )}
              {map.truncated && (
                <p className="font-ui mt-2 text-xs text-amber-800">
                  The pasted text was long, so the map was built from the first part of
                  the article only.
                </p>
              )}
              <p className="font-ui mt-2 text-xs text-stone-500">
                Mapped by {map.model}. This map only records what the article says. It
                does not judge the article — that is your work in the next step.
              </p>
            </div>

            <ol className="mt-4 space-y-4">
              {map.areas.map((area, i) => (
                <li key={area.id} className="border border-stone-300 bg-white p-5">
                  <h3 className="font-ui text-sm font-semibold">
                    {i + 1}. {area.label}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed">{area.summary}</p>

                  {area.keyPoints.length > 0 && (
                    <ul className="font-ui mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700">
                      {area.keyPoints.map((point, j) => (
                        <li key={j}>{point}</li>
                      ))}
                    </ul>
                  )}

                  {area.quotes.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {area.quotes.map((quote, j) => (
                        <blockquote
                          key={j}
                          className="border-l-2 border-stone-400 bg-stone-50 px-4 py-3 text-[15px] italic leading-relaxed"
                        >
                          “{quote}”
                        </blockquote>
                      ))}
                      <p className="font-ui text-xs text-stone-500">
                        Passages copied from the article as pasted above.
                      </p>
                    </div>
                  ) : (
                    <p className="font-ui mt-3 text-sm text-stone-500">
                      No passage was mapped for this area.
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="font-ui mt-8 text-xs leading-relaxed text-stone-500">
          The article and its map stay in this browser tab only. Nothing is saved on a
          server. The API key lives only in <code>server/.env</code> on the back end and
          never appears in this front end. Research appraisal training — not medical advice.
        </p>
      </main>
    </div>
  );
}
