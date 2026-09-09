/** Global balance + presentation constants for Chroma Depot. */

export const VIEW = { w: 1280, h: 720 } as const;

export interface ChromaColor {
  /** Display name, used in tooltips / callouts. */
  name: string;
  /** Main body colour. */
  main: number;
  /** Lighter rim used for highlights and glow. */
  light: number;
  /** Deep shade used for the underside of the orb. */
  dark: number;
  /** Colour-blind friendly glyph stamped on the orb + bay. */
  glyph: string;
}

/** Five hues, each with a distinct glyph so colour is never the only signal. */
export const COLORS: ChromaColor[] = [
  { name: 'Coral',  main: 0xff4d6d, light: 0xffa3b4, dark: 0x8c1c33, glyph: '●' }, // circle
  { name: 'Amber',  main: 0xffb020, light: 0xffdb8f, dark: 0x8a5504, glyph: '▲' }, // triangle
  { name: 'Jade',   main: 0x3ddc84, light: 0xa6f2c6, dark: 0x11743f, glyph: '■' }, // square
  { name: 'Azure',  main: 0x35c4f0, light: 0xa8e6fb, dark: 0x0a5f7d, glyph: '◆' }, // diamond
  { name: 'Violet', main: 0xb15cff, light: 0xdcb6ff, dark: 0x5b1c96, glyph: '✦' }, // star
];

export const SLAG = { main: 0x6b7391, light: 0xa6adc4, dark: 0x2c3247, glyph: '✕' };
export const PRISM = { main: 0xf4f7ff, light: 0xffffff, dark: 0x8e97bd, glyph: '✳' };

export const UI = {
  bg: 0x070915,
  bgDeep: 0x04050e,
  panel: 0x121734,
  panelLight: 0x1c2350,
  line: 0x2b3468,
  text: 0xe8ecff,
  dim: 0x8791c4,
  faint: 0x525c92,
  good: 0x3ddc84,
  warn: 0xffb020,
  bad: 0xff4d6d,
  accent: 0x6ef2ff,
};

export const QUEUE_CAPACITY = 8;
/** Seconds of grace once the rail is full before the depot floods. */
export const OVERFLOW_GRACE = 3.0;

export const BAY_COUNT = 4;

/**
 * The vent recharges faster the hotter your multiplier is: keeping the depot
 * flowing is what buys you a release valve when slag starts arriving.
 */
export const VENT_COOLDOWN_BASE = 6.4;
export const VENT_COOLDOWN_MIN = 2.6;
export function ventCooldown(multiplier: number): number {
  return Math.max(VENT_COOLDOWN_MIN, VENT_COOLDOWN_BASE - (multiplier - 1) * 0.45);
}

/**
 * Seconds without shipping before the multiplier slips by one. The window
 * tightens as the multiplier climbs, so a high multiplier has to be *held*.
 */
export function flowWindow(multiplier: number): number {
  return Math.max(5.5, 12.5 - multiplier * 0.7);
}

export interface WaveSpec {
  /** 1-based wave number. */
  index: number;
  label: string;
  /** Headline shown on the wave banner; empty when nothing new arrives. */
  note: string;
  /** How many hues are in circulation. */
  colors: number;
  /** Seconds between arrivals at the start / end of the wave. */
  spawnFrom: number;
  spawnTo: number;
  /** Inclusive order-size range for newly issued bay orders. */
  orderMin: number;
  orderMax: number;
  /** Spawn weights for special orbs (0..1 of all arrivals). */
  slag: number;
  prism: number;
  twin: number;
  /** Chance a newly issued order is a timed priority order. */
  priority: number;
  /** Seconds a priority order lives. */
  priorityTime: number;
  /** Wave duration in seconds. */
  duration: number;
}

export const WAVES: WaveSpec[] = [
  { index: 1, label: 'INTAKE',    note: 'Route orbs into matching bays',   colors: 3, spawnFrom: 2.30, spawnTo: 1.95, orderMin: 2, orderMax: 3, slag: 0,    prism: 0,    twin: 0,    priority: 0,    priorityTime: 0,  duration: 42 },
  { index: 2, label: 'VOLUME',    note: 'Bigger orders, faster intake',    colors: 3, spawnFrom: 1.90, spawnTo: 1.62, orderMin: 2, orderMax: 4, slag: 0,    prism: 0.05, twin: 0.05, priority: 0,    priorityTime: 0,  duration: 42 },
  { index: 3, label: 'SLAG',      note: 'Slag detected — vent it',    colors: 4, spawnFrom: 1.72, spawnTo: 1.48, orderMin: 2, orderMax: 4, slag: 0.10, prism: 0.05, twin: 0.06, priority: 0,    priorityTime: 0,  duration: 44 },
  { index: 4, label: 'RUSH',      note: 'Priority orders — 3x score', colors: 4, spawnFrom: 1.56, spawnTo: 1.36, orderMin: 3, orderMax: 4, slag: 0.10, prism: 0.06, twin: 0.07, priority: 0.30, priorityTime: 20, duration: 46 },
  { index: 5, label: 'SPECTRUM',  note: 'Fifth hue online',                colors: 5, spawnFrom: 1.46, spawnTo: 1.26, orderMin: 3, orderMax: 5, slag: 0.11, prism: 0.07, twin: 0.07, priority: 0.32, priorityTime: 19, duration: 48 },
  { index: 6, label: 'PRESSURE',  note: 'Heavier slag flow',               colors: 5, spawnFrom: 1.34, spawnTo: 1.16, orderMin: 3, orderMax: 5, slag: 0.15, prism: 0.07, twin: 0.08, priority: 0.34, priorityTime: 18, duration: 48 },
  { index: 7, label: 'SURGE',     note: 'Intake accelerating',             colors: 5, spawnFrom: 1.22, spawnTo: 1.06, orderMin: 3, orderMax: 5, slag: 0.15, prism: 0.08, twin: 0.08, priority: 0.36, priorityTime: 17, duration: 50 },
  { index: 8, label: 'OVERDRIVE', note: 'Everything at once',              colors: 5, spawnFrom: 1.12, spawnTo: 0.96, orderMin: 4, orderMax: 6, slag: 0.13, prism: 0.08, twin: 0.09, priority: 0.40, priorityTime: 16, duration: 52 },
  { index: 9, label: 'MELTDOWN',  note: 'Hold the line',                   colors: 5, spawnFrom: 1.02, spawnTo: 0.88, orderMin: 4, orderMax: 6, slag: 0.14, prism: 0.09, twin: 0.09, priority: 0.42, priorityTime: 15, duration: 54 },
];

/** Endless scaling once the authored waves are exhausted. */
export function waveSpec(index: number): WaveSpec {
  if (index <= WAVES.length) return WAVES[index - 1];
  const last = WAVES[WAVES.length - 1];
  const over = index - WAVES.length;
  const f = Math.pow(0.94, over);
  return {
    ...last,
    index,
    label: 'ENDLESS ' + over,
    note: 'Depot at maximum load',
    spawnFrom: Math.max(0.55, last.spawnFrom * f),
    spawnTo: Math.max(0.5, last.spawnTo * f),
    slag: Math.min(0.18, last.slag + over * 0.008),
    priority: Math.min(0.5, last.priority + over * 0.02),
    duration: 55,
  };
}

export const SCORE = {
  deliver: 10,
  /** Per required unit of a completed order. */
  completeUnit: 50,
  /** Bonus per extra link in a completion chain. */
  chainStep: 220,
  /** Multiplier applied to priority orders. */
  priorityFactor: 3,
  ventSlag: 15,
  multiplierCap: 12,
} as const;

/** Seconds allowed between two completions for them to count as a chain. */
export const CHAIN_WINDOW = 3.2;
