type Save = { best: number; sound: boolean; reducedMotion: boolean; wins: number };
const KEY = 'lumen:progress:v1';
const fixtureMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fixture');
export function readSave(): Save {
  const fallback = { best: 0, sound: true, reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, wins: 0 };
  if (fixtureMode) return fallback;
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return {
      best: Number.isFinite(data.best) && data.best >= 0 ? Math.floor(data.best) : 0,
      sound: typeof data.sound === 'boolean' ? data.sound : fallback.sound,
      reducedMotion: typeof data.reducedMotion === 'boolean' ? data.reducedMotion : fallback.reducedMotion,
      wins: Number.isFinite(data.wins) && data.wins >= 0 ? Math.floor(data.wins) : 0,
    };
  } catch { return fallback; }
}
export function writeSave(save: Save) {
  if (fixtureMode) return;
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* Storage is optional. */ }
}
