// Browser-only session persistence. The session lives in localStorage so a
// page reload keeps the student's work. Nothing is sent to a server store.

export const STORAGE_KEY = 'researchforge-session-v1';

export type StoredFeedback = {
  rating: string;
  gotRight: string;
  // Optional so sessions saved before concept notes existed still load.
  conceptNote?: string;
  quote: string | null;
  quoteReference: string | null;
  quoteVerified: boolean;
  quoteFlag: string | null;
  followUp: string;
};

export type StoredAttempt = { answer: string; feedback: StoredFeedback };

export type StoredSession = {
  version: 1;
  title: string;
  authors: string;
  text: string;
  map: {
    article: { title: string; authors: string };
    truncated: boolean;
    model: string;
    areas: { id: string; label: string; summary: string; keyPoints: string[]; quotes: string[] }[];
  } | null;
  stage: 'intake' | 'loop' | 'summary';
  current: number;
  attempts: StoredAttempt[][];
  overall: StoredAttempt | null;
  draft: string;
  overallDraft: string;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function validFeedback(v: unknown): v is StoredFeedback {
  if (!isObject(v)) return false;
  return (
    typeof v.rating === 'string' &&
    typeof v.gotRight === 'string' &&
    (typeof v.quote === 'string' || v.quote === null) &&
    typeof v.followUp === 'string'
  );
}

function validAttempt(v: unknown): v is StoredAttempt {
  return isObject(v) && typeof v.answer === 'string' && validFeedback(v.feedback);
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed) || parsed.version !== 1) return null;
  if (typeof parsed.title !== 'string' || typeof parsed.authors !== 'string' || typeof parsed.text !== 'string') return null;
  if (parsed.stage !== 'intake' && parsed.stage !== 'loop' && parsed.stage !== 'summary') return null;
  if (!Array.isArray(parsed.attempts) || !parsed.attempts.every((l) => Array.isArray(l) && l.every(validAttempt))) return null;
  if (parsed.overall !== null && !validAttempt(parsed.overall)) return null;
  if (typeof parsed.current !== 'number' || parsed.current < 0 || parsed.current > 4) return null;
  const map = parsed.map;
  if (map !== null) {
    if (!isObject(map) || !isObject(map.article) || !Array.isArray(map.areas) || map.areas.length !== 5) return null;
  }
  // A loop/summary session without a map cannot be judged or exported.
  if (parsed.stage !== 'intake' && map === null) return null;
  return {
    version: 1,
    title: parsed.title,
    authors: parsed.authors,
    text: parsed.text,
    map: map as StoredSession['map'],
    stage: parsed.stage,
    current: parsed.current,
    attempts: parsed.attempts as StoredAttempt[][],
    overall: parsed.overall as StoredAttempt | null,
    draft: typeof parsed.draft === 'string' ? parsed.draft : '',
    overallDraft: typeof parsed.overallDraft === 'string' ? parsed.overallDraft : '',
  };
}

export function loadSession(): StoredSession | null {
  try {
    return parseStoredSession(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage full or unavailable: the session still lives in the tab.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
