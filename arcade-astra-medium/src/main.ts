import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Game, CAPACITY, STAGES, TOTAL_ORDERS, type Color } from './model.ts';
import { Sound } from './audio.ts';
import { box, button, C, COLORS, Effects, line, mono, NAMES, symbol, text } from './visuals.ts';
import './style.css';

const WIDTH = 1280, HEIGHT = 720;
const app = new Application();
const sound = new Sound();
let game = new Game();
let best = 0;
try { best = Number(localStorage.getItem('chroma-best')) || 0; } catch { /* storage is optional */ }
let previousBest = best;
let help = false;
let helpResume = false;
let dirty = true;
let lastRevision = -1;
let clock = 0;
let toast = '';
let toastTime = 0;
let warned = false;
const root = new Container();
const background = new Container();
const ui = new Container();
const dynamic = new Container();
const effects = new Effects();
const modal = new Container();
const meters = new Graphics();
const clockText = text(dynamic, '', 198, 364, 12, C.muted, { fontFamily: 'Consolas, monospace' });
const pressureText = text(dynamic, '', 1025, 554, 11, COLORS[1], { fontWeight: '700' }); pressureText.anchor.x = 1;
const announcement = text(dynamic, '', 764, 529, 12, C.mint, { fontWeight: '700' }); announcement.anchor.set(0.5);
dynamic.addChild(meters);
const laneX = (i: number) => 308 + i * 228;
const cellX = (i: number) => 320 + i * 74;
let priorCells = new Map<number, number>();

function action(fn: () => void) { return () => { sound.unlock(); fn(); dirty = true; }; }
function restart() {
  game = new Game(); game.start(); previousBest = best;
  effects.reset(); toast = ''; toastTime = 0; help = false; warned = false; lastRevision = -1; dirty = true;
}
function toggleHelp() {
  if (help) { help = false; if (helpResume && game.mode === 'paused') game.pause(); }
  else { helpResume = game.mode === 'playing'; if (helpResume) game.pause(); help = true; }
  dirty = true;
}
function choose(color: Color) {
  if (help || (game.mode !== 'ready' && game.mode !== 'playing')) return;
  game.select(color); sound.select(color); dirty = true;
}
function deliver(index: number) { if (!help) game.dispatch(index); }
function purge() {
  if (help) return;
  if (game.vent()) { sound.tone(170, 0.35, 0.04, 0, 'triangle'); toast = 'SPACE TO BREATHE  ·  Flush recharges as you deliver'; toastTime = 3; }
}

function makeBackground() {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b101d'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(825, 270, 0, 825, 270, 760);
  glow.addColorStop(0, '#152537'); glow.addColorStop(0.6, '#101825'); glow.addColorStop(1, '#0b101d');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const sprite = new Sprite(Texture.from(canvas)); background.addChild(sprite);
  const dots = new Graphics();
  for (let x = 16; x < WIDTH; x += 24) for (let y = 16; y < HEIGHT; y += 24) dots.circle(x, y, 0.65).fill({ color: 0x778ba5, alpha: 0.10 });
  background.addChild(dots);
  line(background, 40, 111, 1240, 111);
  line(background, 40, 677, 1240, 677);
  // A small custom mark: four colors converging on one route.
  const mark = new Graphics();
  mark.poly([40, 48, 53, 35, 65, 35, 52, 48, 65, 61, 53, 61]).fill(C.mint);
  mark.poly([60, 48, 73, 35, 80, 35, 67, 48, 80, 61, 73, 61]).fill({ color: C.mint, alpha: 0.4 });
  background.addChild(mark);
  text(background, 'CHROMA', 95, 27, 28, C.text, { fontWeight: '900', letterSpacing: 3.5 });
  mono(background, 'D I S P A T C H', 96, 64, 12, C.mint);
  mono(background, 'A LITTLE ORDER IN THE CHAOS.', 40, 691, 10, C.faint);
}

function drawHeader() {
  box(ui, 297, 41, 104, 26, 0x152b27, 13, 0x29493e);
  ui.addChild(new Graphics().circle(311, 54, 3).fill(C.mint));
  mono(ui, 'TERMINAL 04', 322, 47, 9, C.mint);
  mono(ui, 'SCORE', 493, 29, 10);
  text(ui, String(game.score).padStart(6, '0'), 491, 44, 33, C.text, { fontWeight: '700', letterSpacing: 1 });
  line(ui, 665, 35, 665, 82);
  mono(ui, 'PERSONAL BEST', 692, 29, 10);
  text(ui, best.toLocaleString(), 691, 49, 25, C.muted, { fontWeight: '600' });
  box(ui, 855, 30, 120, 53, 0x192734, 12, game.combo > 0 ? 0x3e6759 : C.line);
  text(ui, `×${game.multiplier}`, 871, 34, 29, game.combo > 0 ? C.mint : C.muted, { fontWeight: '800' });
  mono(ui, 'FLOW', 924, 40, 10, C.mint);
  mono(ui, `${game.combo} CHAIN`, 922, 57, 9);
  button(ui, '?', 1031, 37, 39, 39, action(toggleHelp));
  button(ui, sound.muted ? 'SFX ×' : 'SFX ♪', 1080, 37, 68, 39, action(() => sound.toggle()));
  button(ui, game.mode === 'paused' ? '▶' : 'Ⅱ', 1158, 37, 40, 39, action(() => { if (!help) game.pause(); }), false, game.mode === 'playing' || game.mode === 'paused');
  mono(ui, '01—05', 1207, 48, 9, C.faint);
}

function drawSidebar() {
  const stage = STAGES[game.stage];
  box(ui, 40, 146, 218, 252);
  mono(ui, 'YOUR SHIFT', 60, 165, 10);
  mono(ui, `${String(game.stage + 1).padStart(2, '0')} / 05`, 176, 165, 10, C.mint);
  text(ui, stage.name, 60, 195, 25, C.text, { fontWeight: '700', letterSpacing: -0.7 });
  mono(ui, stage.label, 61, 233, 9, C.mint);
  text(ui, stage.detail, 60, 258, 12, C.muted, { lineHeight: 20 });
  for (let i = 0; i < 5; i++) box(ui, 60 + i * 37, 315, 29, 4, i <= game.stage ? C.mint : C.line, 2, 0);
  text(ui, `${game.completed}`, 60, 333, 25, C.text, { fontWeight: '700' });
  text(ui, `/ ${TOTAL_ORDERS} orders`, 99, 342, 12, C.muted);
  mono(ui, 'SHIFT TIME', 60, 367, 9);
  box(ui, 40, 416, 218, 247);
  if (game.mode === 'ready' || !game.started) {
    mono(ui, 'FIND YOUR FLOW', 60, 437, 10, C.mint);
    text(ui, 'Small cells.\nBig decisions.', 60, 463, 23, C.text, { fontWeight: '700', lineHeight: 29 });
    text(ui, 'Select a cell, then a matching\norder. Same colors go together.', 60, 535, 12, C.muted, { lineHeight: 19 });
    const firstDock = game.selected === null ? -1 : game.docks.findIndex((_, i) => game.front(i).color === game.selected);
    button(ui, game.mode === 'ready' ? 'Start shift   →' : firstDock >= 0 ? `Send to dock 0${firstDock + 1}   ↑` : 'Select a color   →', 60, 595, 178, 44, action(() => {
      if (game.mode === 'ready') { game.start(); choose(0); }
      else if (firstDock >= 0) deliver(firstDock);
      else choose(0);
    }), true);
  } else {
    mono(ui, 'NEED SOME SPACE?', 60, 437, 10, C.mint);
    text(ui, 'Emergency flush', 60, 463, 19, C.text, { fontWeight: '700' });
    text(ui, 'Eject up to 4 selected cells,\nor the 4 oldest. Breaks your flow.', 60, 500, 12, C.muted, { lineHeight: 20 });
    box(ui, 60, 555, 178, 4, C.line, 2, 0);
    if (game.ventCharge > 0) box(ui, 60, 555, 178 * game.ventCharge / 24, 4, C.mint, 2, 0);
    mono(ui, game.ventCharge >= 24 ? 'CHARGED & READY' : `${game.ventCharge} / 24 CELLS TO RECHARGE`, 60, 571, 9, game.ventCharge >= 24 ? C.mint : C.muted);
    button(ui, '↟  Flush queue     [F]', 60, 599, 178, 39, action(purge), false, game.ventCharge >= 24 && game.queue.length > 0);
  }
}

function drawDocks() {
  box(ui, 284, 146, 956, 370, 0x101927, 18, 0x293549);
  mono(ui, 'OUTBOUND ORDERS', 308, 167, 11);
  mono(ui, 'FILL · CLEAR · KEEP IT MOVING', 973, 169, 9, C.faint);
  for (let i = 0; i < 4; i++) {
    const dock = game.docks[i], front = dock.busy > 0 && dock.previous ? dock.previous : game.front(i), x = laneX(i), color = COLORS[front.color];
    const valid = game.selected === front.color && dock.busy === 0;
    const amount = Math.min(game.selectedCount, front.need - front.filled);
    mono(ui, `DOCK 0${i + 1}`, x + 1, 200, 9, C.faint);
    mono(ui, `[${i + 1}]`, x + 187, 200, 9, C.faint);
    const card = new Container(); card.position.set(x, 221); ui.addChild(card);
    box(card, 0, 5, 212, 231, 0x080f1c, 13, 0);
    box(card, 0, 0, 212, 230, valid ? 0x1a2d34 : 0x182334, 13, valid ? color : 0x334258);
    const hover = box(card, 1, 1, 210, 228, color, 12, 0, 0.04); hover.alpha = 0;
    const stripe = new Graphics().roundRect(17, 0, 178, 2, 1).fill({ color, alpha: valid ? 1 : 0.6 }); card.addChild(stripe);
    mono(card, NAMES[front.color], 16, 17, 10, color);
    mono(card, dock.busy > 0 ? '↑' : dock.order.layers.length > 1 ? `${dock.order.layer + 1}/2` : '●', 175, 17, 10, dock.order.layers.length > 1 ? C.muted : color);
    card.addChild(new Graphics().circle(106, 82, 41).fill({ color, alpha: 0.045 }).circle(106, 82, 31).stroke({ color, alpha: 0.12, width: 1 }));
    symbol(card, front.color, 106, 81, 24);
    const count = text(card, `${front.filled} / ${front.need}`, 106, 126, 28, C.text, { fontWeight: '700', letterSpacing: 2 }); count.anchor.x = 0.5;
    const barWidth = front.need * 29 - 5, start = (212 - barWidth) / 2;
    for (let p = 0; p < front.need; p++) {
      box(card, start + p * 29, 169, 24, 6, p < front.filled ? color : 0x2e3b4e, 3, 0);
      if (valid && p >= front.filled && p < front.filled + amount) box(card, start + p * 29, 169, 24, 6, color, 3, 0, 0.38);
    }
    line(card, 15, 190, 197, 190, 0x2e3b4e);
    if (dock.busy > 0) {
      const t = mono(card, 'ROUTING…', 106, 205, 10, C.mint); t.anchor.x = 0.5;
    } else if (valid) {
      const t = text(card, `Dispatch ${amount}  ↑`, 106, 201, 13, color, { fontWeight: '700' }); t.anchor.x = 0.5;
    } else if (dock.order.layers.length > dock.order.layer + 1) {
      const next = dock.order.layers[dock.order.layer + 1];
      mono(card, 'THEN', 53, 205, 9, C.muted); symbol(card, next.color, 108, 211, 7); mono(card, `×${next.need}`, 124, 204, 10, COLORS[next.color]);
    } else { const t = mono(card, 'MATCH TO DISPATCH', 106, 205, 9, C.faint); t.anchor.x = 0.5; }
    card.eventMode = 'static'; card.cursor = game.selected === null ? 'default' : 'pointer';
    card.on('pointertap', action(() => deliver(i)));
    card.on('pointerover', () => { hover.alpha = 1; }); card.on('pointerout', () => { hover.alpha = 0; });
    box(ui, x + 7, 463, 198, 34, 0x151f30, 8, 0x28354a);
    mono(ui, 'NEXT', x + 20, 474, 9, C.faint);
    const next = dock.next.layers[0];
    symbol(ui, next.color, x + 83, 480, 7); mono(ui, `×${next.need}`, x + 96, 472, 11, COLORS[next.color]);
    if (dock.next.layers.length > 1) {
      mono(ui, '›', x + 132, 473, 10, C.faint);
      symbol(ui, dock.next.layers[1].color, x + 153, 480, 6); mono(ui, `×${dock.next.layers[1].need}`, x + 165, 473, 10, COLORS[dock.next.layers[1].color]);
    } else mono(ui, '→', x + 172, 472, 13, C.faint);
    line(ui, x + 106, 517, x + 106, 532, valid ? color : C.line, 0.8);
    ui.addChild(new Graphics().circle(x + 106, 516, 2).fill(valid ? color : C.line));
  }
}

function drawQueue() {
  const selected = game.selected;
  const danger = game.queue.length >= 10;
  box(ui, 284, 543, 956, 120, 0x121d2d, 16, danger ? 0x855046 : 0x344458);
  mono(ui, 'INCOMING BUFFER', 308, 554, 10, C.muted);
  if (selected !== null) {
    symbol(ui, selected, 482, 561, 5);
    mono(ui, `${game.selectedCount} ${NAMES[selected]} SELECTED`, 495, 554, 10, COLORS[selected]);
  } else mono(ui, 'SELECT A COLOR ↓', 480, 554, 9, C.faint);
  mono(ui, `${String(game.queue.length).padStart(2, '0')} / 12`, 1070, 554, 10, danger ? COLORS[1] : C.muted);
  const fresh = new Map<number, number>();
  for (let i = 0; i < CAPACITY; i++) {
    const x = cellX(i), cell = game.queue[i];
    box(ui, x, 583, 62, 57, 0x0d1523, 10, 0x263449);
    if (!cell) {
      line(ui, x + 27, 611, x + 35, 611, 0x2b3a4e);
      line(ui, x + 31, 607, x + 31, 615, 0x2b3a4e);
      continue;
    }
    fresh.set(cell.id, i);
    const color = COLORS[cell.color], chosen = cell.color === selected;
    const tile = new Container(); tile.position.set(x, chosen ? 578 : 583); ui.addChild(tile);
    box(tile, 0, 4, 62, 57, 0x080e19, 10, 0);
    box(tile, 0, 0, 62, 57, color, 10, chosen ? 0xffffff : color, chosen ? 0.23 : 0.12);
    box(tile, 7, 5, 48, 2, color, 1, 0, 0.22);
    symbol(tile, cell.color, 31, 28, 13);
    if (chosen) tile.addChild(new Graphics().circle(52, 9, 3).fill(color));
    tile.eventMode = 'static'; tile.cursor = 'pointer';
    tile.on('pointertap', action(() => choose(cell.color)));
    tile.on('pointerover', () => { tile.y -= 3; });
    tile.on('pointerout', () => { tile.y = chosen ? 578 : 583; });
  }
  priorCells = fresh;
  mono(ui, 'UP NEXT', 1173, 644, 8, C.faint);
  symbol(ui, game.incoming, 1224, 649, 5);
  if (game.mode === 'ready' || !game.started) {
    mono(ui, '01  SELECT A COLOR', 390, 525, 10, C.mint);
    mono(ui, '02  CLICK A MATCHING ORDER', 704, 525, 10, C.mint);
  } else if (toastTime <= 0 && selected !== null && !game.docks.some((_, i) => game.front(i).color === selected)) {
    mono(ui, 'NO MATCH YET · Clear another order to reveal new colors', 513, 525, 10, COLORS[selected]);
  }
  mono(ui, 'CLICK TO SELECT  /  CLICK A DOCK TO SEND', 709, 691, 9, C.faint);
  mono(ui, '[P] PAUSE    [?] HELP', 1077, 691, 9, C.faint);
}

function drawModal() {
  modal.removeChildren().forEach(c => c.destroy({ children: true }));
  if (!help && !['paused', 'lost', 'won'].includes(game.mode)) return;
  const shade = box(modal, 0, 0, WIDTH, HEIGHT, C.bg, 0, 0, 0.86);
  shade.eventMode = 'static';
  if (help) {
    box(modal, 355, 128, 570, 470, 0x172334, 22, 0x405069);
    mono(modal, 'THE DISPATCHER’S FIELD GUIDE', 393, 160, 10, C.mint);
    text(modal, 'A little order. A lot of flow.', 393, 187, 30, C.text, { fontWeight: '700' });
    const rows = [
      ['01', 'Group your colors', 'Click any cell to select every cell of that color.'],
      ['02', 'Fill an order', 'Click a matching dock. Extra cells stay in the buffer.'],
      ['03', 'Think one order ahead', 'NEXT shows what’s coming. Layered orders fill in sequence.'],
      ['04', 'Make room, make points', 'A full buffer gives you 5 seconds. Flush can save your shift.'],
    ];
    rows.forEach(([n, title, desc], i) => {
      const y = 247 + i * 61;
      mono(modal, n, 394, y + 3, 13, C.mint);
      text(modal, title, 436, y, 16, C.text, { fontWeight: '700' });
      text(modal, desc, 436, y + 25, 12, C.muted);
    });
    text(modal, 'Full batches earn bonuses. Clear orders within 11s to build a ×5 flow.', 393, 500, 12, C.mint);
    mono(modal, 'A/S/D/G COLORS · 1–4 DOCKS · F FLUSH · P PAUSE · M SOUND', 393, 526, 9);
    button(modal, 'Got it. Let’s flow.   →', 393, 554, 494, 30, action(toggleHelp), true);
    return;
  }
  if (game.mode === 'paused') {
    box(modal, 430, 211, 420, 298, 0x172334, 22, 0x405069);
    mono(modal, 'TAKE A BREATH', 465, 241, 11, C.mint);
    text(modal, 'Your flow can wait.', 465, 277, 31, C.text, { fontWeight: '700' });
    text(modal, 'The terminal is paused. Your cells are safe.', 465, 328, 13, C.muted);
    button(modal, 'Resume shift   →', 465, 373, 350, 45, action(() => game.pause()), true);
    button(modal, 'Start over', 465, 432, 168, 38, action(restart));
    button(modal, 'How to play', 647, 432, 168, 38, action(toggleHelp));
    return;
  }
  const won = game.mode === 'won';
  box(modal, 393, 127, 494, 474, 0x172334, 22, won ? 0x6da88e : 0x62505a);
  mono(modal, won ? 'ALL CARGO ACCOUNTED FOR' : 'THE BUFFER OVERFLOWED', 430, 159, 11, won ? C.mint : COLORS[1]);
  text(modal, won ? 'Beautifully dispatched.' : 'A little too much chaos.', 430, 194, 30, C.text, { fontWeight: '700', letterSpacing: -0.5 });
  text(modal, won ? 'Shift complete. That’s what we call flow.' : 'Every shift is a fresh start. Find your rhythm.', 430, 242, 13, C.muted);
  mono(modal, 'FINAL SCORE', 430, 291, 10);
  text(modal, game.score.toLocaleString(), 426, 309, 53, C.text, { fontWeight: '800' });
  if (game.score > previousBest) mono(modal, '↗ NEW PERSONAL BEST', 644, 337, 10, C.mint);
  line(modal, 430, 380, 850, 380);
  const stats = [[`${game.completed}/30`, 'ORDERS'], [String(game.perfects), 'FULL BATCHES'], [`${game.bestCombo}`, 'BEST CHAIN']];
  stats.forEach(([value, label], i) => { text(modal, value, 430 + i * 148, 399, 25, C.mint, { fontWeight: '700' }); mono(modal, label, 430 + i * 148, 435, 9); });
  button(modal, 'Another shift   ↗', 430, 480, 420, 48, action(restart), true);
  text(modal, won ? 'Try holding full batches to beat your personal best.' : 'Tip: save your flush for colors with no matching dock.', 430, 553, 12, C.muted);
}

function renderUI() {
  ui.removeChildren().forEach(c => c.destroy({ children: true }));
  drawHeader(); drawSidebar(); drawDocks(); drawQueue(); drawModal();
  lastRevision = game.revision; dirty = false;
}

function handleEvents() {
  for (const event of game.events.splice(0)) {
    if (event.type === 'send') {
      event.ids.forEach((id, i) => effects.fly(cellX(priorCells.get(id) ?? 0) + 31, 607, laneX(event.dock) + 106, 301, event.color, i * 0.045));
      effects.label(event.perfect ? `FULL BATCH  +${event.points}` : `+${event.points}`, laneX(event.dock) + 106, 273, COLORS[event.color], event.perfect ? 16 : 23);
      sound.send(event.color, event.perfect);
    } else if (event.type === 'clear' || event.type === 'layer') {
      effects.burst(laneX(event.dock) + 106, 313, COLORS[event.color], event.type === 'clear' ? 24 : 12);
      if (event.type === 'clear') sound.clear();
    } else if (event.type === 'arrive') {
      const i = game.queue.findIndex(c => c.id === event.id);
      if (i >= 0) effects.burst(cellX(i) + 31, 612, COLORS[game.queue[i].color], 5);
      sound.tone(240, 0.05, 0.012);
    } else if (event.type === 'invalid') {
      effects.label('Different color', laneX(event.dock) + 106, 412, C.muted, 13);
      sound.tone(140, 0.08, 0.025);
    } else if (event.type === 'stage') {
      toast = `SHIFT ${event.stage + 1}  /  ${STAGES[event.stage].label}`; toastTime = 4; sound.stage();
    } else if (event.type === 'vent') {
      for (const id of event.ids) effects.burst(cellX(priorCells.get(id) ?? 0) + 31, 608, C.muted, 12);
    } else if (event.type === 'end') {
      best = Math.max(best, game.score);
      try { localStorage.setItem('chroma-best', String(best)); } catch { /* optional storage */ }
      if (event.won) { sound.stage(); for (let i = 0; i < 4; i++) effects.burst(440 + 130 * i, 220, COLORS[i], 35); }
      else sound.tone(110, 0.8, 0.05, 0, 'triangle');
    }
  }
}

function updateDynamic(dt: number) {
  clock += dt;
  if (game.mode === 'playing') toastTime = Math.max(0, toastTime - dt);
  const timer = `${Math.floor(game.elapsed / 60).toString().padStart(2, '0')}:${Math.floor(game.elapsed % 60).toString().padStart(2, '0')}`;
  clockText.text = timer;
  pressureText.text = game.fullTime > 0 && game.mode === 'playing' ? `${Math.max(0, 5 - game.fullTime).toFixed(1)}s TO CLEAR` : '';
  announcement.text = toastTime > 0 ? toast : '';
  meters.clear();
  if (game.started) {
    meters.roundRect(308, 650, 840, 2, 1).fill(0x263348);
    meters.roundRect(308, 650, 840 * Math.min(1, game.spawnTime / game.interval), 2, 1).fill({ color: game.queue.length >= 10 ? COLORS[1] : C.mint, alpha: 0.6 });
  }
  if (game.comboTime > 0) meters.roundRect(865, 78, 100 * game.comboTime / 11, 2, 1).fill(C.mint);
  if (game.queue.length >= 10) {
    meters.roundRect(284, 543, 956, 120, 16).stroke({ color: COLORS[1], width: 1.5, alpha: 0.35 + Math.sin(clock * 6) * 0.25 });
    if (!warned && game.mode === 'playing') { sound.tone(240, 0.15, 0.03); warned = true; }
  } else warned = false;
  if (game.selected !== null) {
    for (let i = 0; i < 4; i++) if (game.front(i).color === game.selected && game.docks[i].busy === 0) {
      meters.roundRect(laneX(i) - 3, 218, 218, 236, 16).stroke({ color: COLORS[game.selected], width: 1, alpha: 0.20 + Math.sin(clock * 3) * 0.1 });
    }
  }
}

async function boot() {
  await app.init({ width: WIDTH, height: HEIGHT, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, antialias: true, background: C.bg });
  document.getElementById('game')!.appendChild(app.canvas);
  app.canvas.setAttribute('aria-label', 'Chroma Dispatch. Select colors with A S D G, send to docks with 1 to 4. F flushes, P pauses, question mark opens help.');
  app.canvas.tabIndex = 0;
  app.stage.addChild(root); root.addChild(background, ui, dynamic, effects.root, modal);
  makeBackground();
  const resize = () => {
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    app.canvas.style.width = `${WIDTH * scale}px`; app.canvas.style.height = `${HEIGHT * scale}px`;
  };
  window.addEventListener('resize', resize); resize();
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.mode === 'playing') { game.pause(); dirty = true; } });
  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if ([' ', 'escape', 'p', 'f', '?', 'm', 'a', 's', 'd', 'g', '1', '2', '3', '4', 'enter'].includes(key)) event.preventDefault();
    sound.unlock();
    if (key === 'm') sound.toggle();
    else if (key === '?' || (key === 'escape' && help)) toggleHelp();
    else if (!help) {
      if (key === 'p' || key === 'escape') game.pause();
      else if (key === 'enter' && ['won', 'lost'].includes(game.mode)) restart();
      else if (key === 'enter' && game.mode === 'ready') game.start();
      else if (key === 'f') purge();
      else if ('asdg'.includes(key) && key.length === 1) choose('asdg'.indexOf(key) as Color);
      else if ('1234'.includes(key) && key.length === 1) deliver(Number(key) - 1);
    }
    dirty = true;
  });
  app.ticker.add(ticker => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    game.tick(dt); handleEvents();
    if (dirty || game.revision !== lastRevision) renderUI();
    updateDynamic(dt); effects.update(dt);
  });
  document.getElementById('loading')!.remove();
}

void boot().catch(error => {
  console.error(error);
  const loading = document.getElementById('loading');
  if (loading) { loading.textContent = 'Unable to start the terminal. Please reload in a browser with WebGL enabled.'; loading.style.letterSpacing = '0'; }
});
