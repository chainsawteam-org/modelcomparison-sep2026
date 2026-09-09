export const WIDTH = 1280;
export const HEIGHT = 720;
export const CAPACITY = 10;
export const LANES = 6;

export const UI = {
  bg: 0x090f1c, panel: 0x101b2b, inset: 0x0b1422, line: 0x22344a,
  text: 0xedf5ff, muted: 0x7c91aa, dim: 0x41566d, mint: 0x8ef5cf,
  danger: 0xff7188,
};

export const COLORS = [
  { name: 'Mint', hex: 0x7ce9c5, dark: 0x193e3c, symbol: 'diamond' },
  { name: 'Coral', hex: 0xff8e9a, dark: 0x492b3c, symbol: 'circle' },
  { name: 'Amber', hex: 0xffd275, dark: 0x453b29, symbol: 'triangle' },
  { name: 'Iris', hex: 0xb8a0ff, dark: 0x332e50, symbol: 'square' },
  { name: 'Sky', hex: 0x78caff, dark: 0x1c364d, symbol: 'cross' },
] as const;

export const SECTORS = [
  { name: 'First light', colors: 3, rows: 5, interval: 2.9, armor: 0, subtitle: 'Find your rhythm.', description: 'Three colors. Six lanes.\nOne uninterrupted signal.' },
  { name: 'Afterglow', colors: 4, rows: 6, interval: 2.65, armor: 0, subtitle: 'A new frequency.', description: 'Iris joins the spectrum.\nWatch what your next clear reveals.' },
  { name: 'Double exposure', colors: 4, rows: 6, interval: 2.5, armor: 0.24, subtitle: 'Break through the noise.', description: 'Shielded targets take two hits.\nSave a pair for a clean break.' },
  { name: 'Full spectrum', colors: 5, rows: 7, interval: 2.35, armor: 0.2, subtitle: 'Every color has a place.', description: 'Sky enters the mix.\nReroute a lane to open a path.' },
  { name: 'Event horizon', colors: 5, rows: 7, interval: 2.15, armor: 0.35, subtitle: 'Bring it all into focus.', description: 'The final transmission.\nKeep your buffer breathing.' },
] as const;

export const BOARD = { x: 310, y: 143, w: 660, h: 366, laneX: 368, laneGap: 108, bottom: 466, tileH: 37, tileGap: 7, tileW: 76 };
export const BUFFER = { x: 310, y: 535, w: 660, h: 126, startX: 348, cy: 604, gap: 64, size: 48 };
export const laneX = (index: number) => BOARD.laneX + index * BOARD.laneGap;
export const tileY = (index: number) => BOARD.bottom - index * (BOARD.tileH + BOARD.tileGap);
export const packetX = (index: number) => BUFFER.startX + index * BUFFER.gap;
