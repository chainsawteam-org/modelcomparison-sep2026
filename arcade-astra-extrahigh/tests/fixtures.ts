import type { GameModel } from '../src/model';

/** Development-only, deterministic screen fixtures. Start and act through real game controls. */
export function applyFixture(model: GameModel, name: string) {
  if (name === 'victory' || name === 'sector') {
    model.sector = name === 'victory' ? 4 : 1;
    model.setupSector();
    model.lanes = [[{ id: 99901, color: 0, hp: 2, shield: true }], [], [], [], [], []];
    model.queue = [{ id: 99902, color: 0 }, { id: 99903, color: 0 }, { id: 99904, color: 1 }];
    model.score = 28400; model.elapsed = 347; model.totalCleared = 185;
    model.sectorCleared = model.sectorTotal - 1; model.bestChain = 4;
  }
  if (name === 'spectrum') {
    model.sector = 4; model.setupSector();
    model.queue = [0, 1, 1, 2, 3, 3, 4, 0].map((color, index) => ({ color, id: 99900 + index }));
    model.score = 18650; model.totalCleared = 144; model.bestChain = 4;
  }
}
