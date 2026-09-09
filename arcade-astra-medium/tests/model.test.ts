import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, CAPACITY, type Color } from '../src/model.ts';

function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function advance(game: Game, seconds: number) { for (let t = 0; t < seconds; t += 0.05) game.tick(0.05); }

test('first batch teaches the mechanic without time pressure', () => {
  const g = new Game(seeded(1)); g.start(); advance(g, 100);
  assert.equal(g.queue.length, 6); assert.equal(g.elapsed, 0);
  g.select(0); assert.equal(g.selectedCount, 3);
  assert.equal(g.dispatch(1), false); assert.equal(g.queue.length, 6);
  assert.equal(g.dispatch(0), true);
  assert.equal(g.completed, 1); assert.equal(g.queue.length, 3);
  assert.equal(g.perfects, 1); assert.equal(g.score, 300);
  advance(g, 2.5); assert.equal(g.queue.length, 4);
});

test('dispatch caps at remaining capacity and leaves excess selected', () => {
  const g = new Game(seeded(2)); g.start();
  g.queue = Array.from({ length: 7 }, (_, id) => ({ id, color: 0 as Color }));
  g.select(0); g.dispatch(0);
  assert.equal(g.queue.length, 4); assert.equal(g.selected, 0);
  assert.equal(g.dispatch(0), false, 'busy docks reject repeat deliveries');
});

test('layers unlock in sequence and only the finished manifest counts as an order', () => {
  const g = new Game(); g.start();
  g.docks[0].order = { layer: 0, layers: [{ color: 0, need: 3, filled: 0 }, { color: 1, need: 1, filled: 0 }] };
  g.select(0); g.dispatch(0);
  assert.equal(g.completed, 0); assert.equal(g.front(0).color, 1);
  advance(g, 0.5); g.select(1); g.dispatch(0);
  assert.equal(g.completed, 1);
});

test('overflow grace period, rescue and terminal state are reliable', () => {
  const g = new Game(); g.start(); g.started = true;
  g.queue = Array.from({ length: CAPACITY }, (_, id) => ({ id, color: 0 as Color }));
  advance(g, 4); assert.equal(g.mode, 'playing');
  g.select(0); g.dispatch(0); assert.equal(g.fullTime, 0);
  g.queue = Array.from({ length: CAPACITY }, (_, id) => ({ id: id + 100, color: 0 as Color }));
  advance(g, 5.1); assert.equal(g.mode, 'lost');
  const before = g.score; g.dispatch(0); advance(g, 20); assert.equal(g.score, before);
  assert.equal(g.events.filter(e => e.type === 'end').length, 1);
});

test('pause freezes every simulation timer and resumes cleanly', () => {
  const g = new Game(); g.start(); g.select(0); g.dispatch(0); g.pause();
  const state = JSON.stringify(g); advance(g, 20); assert.equal(JSON.stringify(g), state);
  g.pause(); advance(g, 3); assert.ok(g.elapsed > 2.9);
});

test('flush removes selected cells, resets chain and requires recharge', () => {
  const g = new Game(); g.start(); g.select(0);
  assert.equal(g.vent(), true); assert.equal(g.queue.length, 3);
  assert.ok(g.queue.every(c => c.color !== 0)); assert.equal(g.ventCharge, 0);
  assert.equal(g.vent(), false); assert.equal(g.selected, null);
});

test('chain expires and new games never retain prior session state', () => {
  const g = new Game(); g.start(); g.select(0); g.dispatch(0); advance(g, 11.1);
  assert.equal(g.combo, 0); assert.equal(g.multiplier, 1);
  const fresh = new Game();
  assert.equal(fresh.score, 0); assert.equal(fresh.mode, 'ready');
  assert.equal(fresh.queue.length, 6); assert.equal(fresh.ventCharge, 24);
});

test('a demand-aware player completes 40 seeded shifts without deadlock', () => {
  const durations: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const g = new Game(seeded(seed)); g.start();
    for (let t = 0; t < 600 && g.mode === 'playing'; t += 0.2) {
      // Prefer full batches; send partials under pressure or after a short wait.
      const options = g.docks.map((d, i) => {
        const front = g.front(i);
        const count = g.queue.filter(c => c.color === front.color).length;
        return { i, color: front.color, count, remaining: front.need - front.filled, busy: d.busy };
      }).filter(o => o.count > 0 && o.busy === 0)
        .sort((a, b) => Number(b.count >= b.remaining) - Number(a.count >= a.remaining) || b.count - a.count);
      const move = options[0];
      if (move && (move.count >= move.remaining || g.queue.length >= 7 || g.spawnTime > 1.2)) {
        if (g.selected !== move.color) g.select(move.color);
        g.dispatch(move.i);
      } else if (!move && g.queue.length >= 11 && g.ventCharge === 24) { g.selected = null; g.vent(); }
      g.tick(0.2); g.events = [];
      assert.ok(g.queue.length <= CAPACITY); assert.ok(g.ventCharge <= 24);
      for (let i = 0; i < 4; i++) assert.ok(g.front(i).filled < g.front(i).need);
    }
    assert.equal(g.mode, 'won', `seed ${seed}: ${g.completed} orders, ${g.queue.length} queued`);
    assert.equal(g.completed, 30); assert.equal(g.stage, 4);
    durations.push(g.elapsed);
  }
  console.log(`40 complete shifts: ${Math.round(Math.min(...durations))}–${Math.round(Math.max(...durations))} seconds`);
});
