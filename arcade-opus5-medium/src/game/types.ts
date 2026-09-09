export type OrbKind = 'normal' | 'slag' | 'prism' | 'twin';

export interface Orb {
  id: number;
  kind: OrbKind;
  /** Palette index, or -1 for slag / prism which have no hue of their own. */
  color: number;
  /** How many units of an order this orb fills. */
  units: number;
}

export type BayState = 'active' | 'shipping' | 'jammed';

export interface Bay {
  /** Fixed slot index, 0..BAY_COUNT-1. */
  id: number;
  /** Bumped every time a fresh order is issued; views use it to reset. */
  orderId: number;
  color: number;
  required: number;
  filled: number;
  priority: boolean;
  timeLeft: number;
  timeMax: number;
  state: BayState;
  stateTimer: number;
}

export type GameEvent =
  | { type: 'spawn'; orb: Orb }
  | { type: 'deliver'; orb: Orb; bay: number; units: number; points: number; step: number }
  | { type: 'complete'; bay: number; points: number; chain: number; priority: boolean; required: number }
  | { type: 'reject'; orb: Orb; bay: number }
  | { type: 'vent'; orb: Orb; points: number; slag: boolean }
  | { type: 'ventBlocked'; orb: Orb }
  | { type: 'order'; bay: number }
  | { type: 'expire'; bay: number }
  | { type: 'wave'; index: number }
  | { type: 'danger'; on: boolean }
  | { type: 'multiplierLost' }
  | { type: 'multiplierDecay'; value: number }
  | { type: 'gameOver' };

export interface RunStats {
  score: number;
  wave: number;
  delivered: number;
  orders: number;
  bestChain: number;
  bestMultiplier: number;
  vented: number;
  time: number;
}
