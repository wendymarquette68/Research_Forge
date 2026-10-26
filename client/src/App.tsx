import { useEffect, useState } from 'react';

type Health = { ok: boolean; model: string; baseUrl: string; hasKey: boolean };
type TestResult = { ok: boolean; reply?: string; error?: string; code?: string; model?: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealthError('Back end not reachable. Start it with: npm start (in server/)'));
  }, []);

  async function runTestCall() {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/test-call', { method: 'POST' });
      setResult(await r.json());
    } catch {
      setResult({ ok: false, error: 'Back end not reachable.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-4xl items-baseline justify-between px-5 py-4">
          <h1 className="text-xl font-bold tracking-tight">ResearchForge AI</h1>
          <span className="font-ui text-xs text-stone-500">Phase 1 — connection scaffold</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <p className="max-w-2xl text-[17px] leading-relaxed">
          ResearchForge coaches you to judge a scholarly article's strength. It does not
          summarise it for you. This page only checks that the browser, the back end, and
          the Meta Model API can talk to each other.
        </p>

        <section className="mt-8 border border-stone-300 bg-white p-5">
          <h2 className="font-ui text-sm font-semibold">Connection status</h2>
          {healthError && <p className="font-ui mt-3 text-sm text-red-800">{healthError}</p>}
          {health && (
            <dl className="font-ui mt-3 space-y-1.5 text-sm">
              <div className="flex gap-2"><dt className="w-32 text-stone-500">Back end</dt><dd>Reachable</dd></div>
              <div className="flex gap-2"><dt className="w-32 text-stone-500">Model</dt><dd>{health.model} (standard)</dd></div>
              <div className="flex gap-2"><dt className="w-32 text-stone-500">API base</dt><dd>{health.baseUrl}</dd></div>
              <div className="flex gap-2">
                <dt className="w-32 text-stone-500">API key on server</dt>
                <dd>{health.hasKey ? 'Present (value never shown)' : 'Not set yet — add your key to server/.env'}</dd>
              </div>
            </dl>
          )}

          <button
            onClick={runTestCall}
            disabled={busy}
            className="font-ui mt-5 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Calling…' : 'Run one test call'}
          </button>

          {result && (
            <div className={`font-ui mt-4 border p-3 text-sm ${result.ok ? 'border-emerald-700 bg-emerald-50' : 'border-red-300 bg-red-50'}`} role="status">
              {result.ok ? (
                <p>Connected. Model replied: “{result.reply}”</p>
              ) : (
                <p>Not connected: {result.error}{result.code ? ` (${result.code})` : ''}</p>
              )}
            </div>
          )}
        </section>

        <p className="font-ui mt-6 text-xs leading-relaxed text-stone-500">
          The API key lives only in <code>server/.env</code> on the back end. It is gitignored
          and never appears in this front end.
        </p>
      </main>
    </div>
  );
}
