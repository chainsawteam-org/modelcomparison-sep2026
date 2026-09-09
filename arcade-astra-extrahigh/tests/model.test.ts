import test from 'node:test';
import assert from 'node:assert/strict';
import { GameModel, type Tile } from '../src/model';
import { CAPACITY, SECTORS } from '../src/config';

function seeded(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function advance(m: GameModel, seconds: number) { for (let t = 0; t < seconds; t += 0.05) m.tick(Math.min(0.05, seconds - t)); }
function tile(id: number, color: number, hp = 1): Tile { return { id, color, hp, shield: hp > 1 }; }

test('ready and paused states freeze clocks, supply and overflow', () => {
  const m = new GameModel(seeded(1)); const before = JSON.stringify(m);
  advance(m, 50); assert.equal(JSON.stringify(m), before);
  m.start(); m.mode = 'paused'; const paused = JSON.stringify(m);
  advance(m, 50); assert.equal(JSON.stringify(m), paused);
});

test('every opening offers a satisfying two-packet mint burst', () => {
  for (let seed = 0; seed < 100; seed++) {
    const m = new GameModel(seeded(seed)); m.start(); m.select(0);
    assert.deepEqual(m.preview(0), { hits: 2, clears: 2 });
  }
});

test('a selected run includes both neighbors, and unused ammunition stays selected', () => {
  const m = new GameModel(seeded(2)); m.start();
  m.queue = [0, 0, 0, 1, 0].map((color, id) => ({ color, id: 1000 + id }));
  m.lanes[0] = [tile(100, 0), tile(101, 1)];
  m.select(1); assert.equal(m.selected.length, 3);
  m.launch(0);
  assert.equal(m.queue.length, 4); assert.equal(m.selected.length, 2);
  assert.equal(m.lanes[0][0].color, 1); assert.equal(m.totalCleared, 1);
});

test('removing an intervening run merges neighbors without reordering the queue', () => {
  const m = new GameModel(seeded(3)); m.start();
  m.queue = [0, 1, 1, 0, 2].map((color, id) => ({ color, id: id + 1000 }));
  m.lanes[1] = [tile(100, 1), tile(101, 1), tile(102, 2)];
  m.select(1); m.launch(1); m.select(0);
  assert.deepEqual(m.queue.map(p => p.color), [0, 0, 2]); assert.equal(m.selected.length, 2);
  assert.equal(m.combo, 2); assert.equal(m.score, 550);
});

test('a wrong-color launch and invalid lane never consume ammo or award points', () => {
  const m = new GameModel(seeded(4)); m.start(); m.select(0);
  const before = JSON.stringify(m);
  assert.equal(m.launch(1), false); assert.equal(m.launch(-1), false); assert.equal(m.launch(6), false);
  assert.equal(JSON.stringify(m), before);
});

test('a shield takes two hits, including hits split across launches', () => {
  const m = new GameModel(seeded(5)); m.start();
  m.lanes[0] = [tile(9999, 0, 2), tile(9998, 1)];
  m.queue = [{ id: 1000, color: 0 }, { id: 1001, color: 1 }, { id: 1002, color: 0 }];
  m.select(0); m.launch(0); assert.equal(m.lanes[0][0].hp, 1); assert.equal(m.totalCleared, 0);
  m.select(1); m.launch(0); assert.equal(m.lanes[0][0].color, 1); assert.equal(m.totalCleared, 1);
});

test('full buffer has a recoverable grace period, then ends exactly once', () => {
  const m = new GameModel(seeded(6)); m.start();
  while (m.queue.length < CAPACITY) m.callNext();
  advance(m, 4.8); assert.equal(m.mode, 'playing'); assert.equal(m.callNext(), false);
  m.select(0); assert.equal(m.launch(0), true); assert.equal(m.overflowTime, 0);
  while (m.queue.length < CAPACITY) m.callNext();
  advance(m, 5.2); assert.equal(m.mode, 'lost');
  const after = JSON.stringify(m); advance(m, 20); assert.equal(JSON.stringify(m), after);
  assert.equal(m.events.filter(e => e.type === 'end').length, 1);
});

test('reroute reveals a different color, costs energy and cannot farm same-color lanes', () => {
  const m = new GameModel(seeded(7)); m.start();
  m.lanes[0] = [tile(100, 0), tile(101, 0), tile(102, 1), tile(103, 2)];
  assert.equal(m.toggleReroute(), true); assert.equal(m.launch(0), true);
  assert.deepEqual(m.lanes[0].map(t => t.color), [1, 2, 0, 0]); assert.equal(m.energy, 8); assert.equal(m.score, 0);
  m.lanes[1] = [tile(105, 0), tile(106, 0)];
  assert.equal(m.reroute(1), false); assert.equal(m.energy, 8);
  m.energy = 0; assert.equal(m.reroute(0), false);
});

test('restarts reset all run state and next-sector operations are guarded', () => {
  const m = new GameModel(seeded(8)); m.start(); m.select(0); m.launch(0); advance(m, 10);
  m.nextSector(); assert.equal(m.sector, 0);
  m.restart(); assert.equal(m.mode, 'playing'); assert.equal(m.sector, 0);
  assert.equal(m.score, 0); assert.equal(m.elapsed, 0); assert.equal(m.totalLaunched, 0);
  assert.equal(m.queue.length, 5); assert.equal(m.energy, 16); assert.equal(m.selected.length, 0);
  assert.deepEqual(m.events, []);
});

test('sector completion and final victory freeze gameplay and permit a fresh run', () => {
  const m = new GameModel(seeded(9)); m.start();
  for (let sector = 0; sector < SECTORS.length; sector++) {
    m.lanes = [[tile(900 + sector, 0)], [], [], [], [], []];
    m.select(0); assert.equal(m.launch(0), true);
    assert.equal(m.mode, sector === 4 ? 'won' : 'sectorEnd');
    const state = JSON.stringify(m); advance(m, 20); assert.equal(JSON.stringify(m), state);
    m.nextSector();
  }
  assert.equal(m.mode, 'won'); m.restart(); assert.equal(m.mode, 'playing'); assert.equal(m.sector, 0);
});

test('forecast replaces colors as soon as their last target disappears', () => {
  const m = new GameModel(seeded(10)); m.start();
  m.lanes = [[tile(999, 0)], [tile(998, 1), tile(997, 1)], [], [], [], []];
  m.upcoming = [0, 0, 0]; m.select(0); m.launch(0);
  assert.deepEqual(m.upcoming, [1, 1, 1]);
});

test('generated campaigns remain completable under a simple routing policy', () => {
  let wins = 0; const durations: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const m = new GameModel(seeded(seed)); m.start();
    for (let turns = 0; turns < 9000 && m.mode !== 'won' && m.mode !== 'lost'; turns++) {
      if (m.mode === 'sectorEnd') { m.nextSector(); continue; }
      let move: { packet: number; lane: number; value: number } | null = null;
      for (let p = 0; p < m.queue.length; p++) {
        m.select(p);
        for (let l = 0; l < 6; l++) {
          const preview = m.preview(l);
          const value = preview.hits * 10 + preview.clears;
          if (value > 0 && (!move || value > move.value)) move = { packet: p, lane: l, value };
        }
      }
      if (move) { m.select(move.packet); m.launch(move.lane); }
      else if (m.queue.length >= 6 && m.energy >= 8) {
        for (let l = 0; l < 6; l++) {
          const stack = m.lanes[l];
          const next = stack.find(t => t.color !== stack[0]?.color);
          if (next && m.queue.some(p => p.color === next.color)) { m.reroute(l); break; }
        }
      }
      advance(m, 0.25);
      assert.ok(m.queue.length <= CAPACITY);
      assert.ok(m.lanes.flat().every(t => t.hp > 0));
      assert.ok(m.energy >= 0 && m.energy <= 16);
      m.events = [];
    }
    if (m.mode === 'won') { wins++; durations.push(m.elapsed); }
  }
  console.log(`Campaign simulation: ${wins}/40 wins; mean duration ${(durations.reduce((a, b) => a + b, 0) / durations.length / 60).toFixed(1)} minutes.`);
  assert.ok(wins >= 36, `Only ${wins}/40 campaigns completed. Check supply or reroute deadlocks.`);
});
