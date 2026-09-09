import { BAY_W } from './bay-view';
import { QUEUE_CAPACITY } from './config';

/** Fixed 1280x720 layout metrics shared by the scene and its widgets. */
export const SLOT_W = 86;
export const SLOT_GAP = 12;
export const RAIL_Y = 516;
export const RAIL_TOTAL = QUEUE_CAPACITY * SLOT_W + (QUEUE_CAPACITY - 1) * SLOT_GAP;
export const RAIL_X0 = Math.round((1280 - RAIL_TOTAL) / 2);

export const slotX = (i: number) => RAIL_X0 + SLOT_W / 2 + i * (SLOT_W + SLOT_GAP);

export const VENT = { x: 148, y: RAIL_Y, r: 54 };
export const PORT = { x: 1074, y: RAIL_Y };
export const PREVIEW_X = [1124, 1168, 1210];

export const BAY_Y = 94;
export const BAY_GAP = 22;
export const BAY_X0 = Math.round((1280 - (4 * BAY_W + 3 * BAY_GAP)) / 2);
export const bayX = (i: number) => BAY_X0 + i * (BAY_W + BAY_GAP);

export const GAUGE = { x: RAIL_X0, y: 594, w: RAIL_TOTAL, h: 12 };
export const BANNER_Y = 372;
