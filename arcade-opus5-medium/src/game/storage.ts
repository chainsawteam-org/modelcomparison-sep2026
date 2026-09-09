const KEY = 'chroma-depot.v1';

interface Saved {
  best: number;
  muted: boolean;
  runs: number;
}

const fallback: Saved = { best: 0, muted: false, runs: 0 };

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      best: Number(parsed.best) || 0,
      muted: !!parsed.muted,
      runs: Number(parsed.runs) || 0,
    };
  } catch {
    return { ...fallback };
  }
}

function write(v: Saved): void {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ }
}

/** Tiny localStorage-backed profile. Failures degrade to an in-memory default. */
export const Save = {
  get best() { return read().best; },
  get muted() { return read().muted; },
  get runs() { return read().runs; },
  /** Returns true when the score is a new personal best. */
  submit(score: number): boolean {
    const s = read();
    s.runs++;
    const better = score > s.best;
    if (better) s.best = score;
    write(s);
    return better;
  },
  setMuted(m: boolean) { const s = read(); s.muted = m; write(s); },
};
