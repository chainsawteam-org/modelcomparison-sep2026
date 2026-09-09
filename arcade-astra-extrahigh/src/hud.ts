import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, SECTORS, UI } from './config';
import { button, chip, label, line, micro, panel } from './draw';
import type { GameModel } from './model';

export type Actions = { start: () => void; pause: () => void; help: () => void; sound: () => void; reroute: () => void; callNext: () => void };

export class Hud {
  root = new Container();
  private score: Text;
  private best: Text;
  private status: Text;
  private left = new Container();
  private forecast = new Container();
  private dynamic = new Graphics();
  private combo: Text;
  private comboNote: Text;
  private nextTime: Text;
  private capacity: Text;
  private progress?: Text;
  private routeButton: Container;
  private routeText: Text;
  private soundText: Text;
  private pauseText: Text;
  private lastLeft = '';
  private lastForecast = '';
  private intro: Text;
  private time = 0;

  constructor(private model: GameModel, private actions: Actions) {
    const g = new Graphics();
    for (let i = 0; i < 3; i++) g.poly([42 + i * 8, 58, 52 + i * 8, 29, 58 + i * 8, 29, 48 + i * 8, 58]).fill({ color: UI.mint, alpha: 1 - i * 0.22 });
    line(g, 40, 93, 1240, 93, UI.line, 0.65);
    line(g, 40, 683, 270, 683, UI.line, 0.5);
    line(g, 1002, 683, 1240, 683, UI.line, 0.5);
    this.root.addChild(g);
    label(this.root, 'LUMEN', 86, 23, 31, UI.text, { fontWeight: '700', letterSpacing: 6 });
    micro(this.root, 'S I G N A L   F L O W', 88, 65, UI.muted, 8);
    this.status = micro(this.root, '●  STANDBY', 335, 41, UI.mint, 10);
    micro(this.root, 'FIVE SECTORS. ONE SIGNAL.', 495, 42, UI.dim, 9);
    micro(this.root, 'SCORE', 774, 23, UI.muted, 9);
    this.score = label(this.root, '000000', 774, 39, 27, UI.text, { fontFamily: 'Consolas, monospace', fontWeight: '600', letterSpacing: 1 });
    micro(this.root, 'PERSONAL BEST', 935, 23, UI.muted, 9);
    this.best = label(this.root, '000000', 935, 43, 21, UI.muted, { fontFamily: 'Consolas, monospace', letterSpacing: 1 });
    const soundButton = button(this.root, '', 1110, 30, 38, 38, actions.sound);
    const soundIcon = new Graphics().poly([9, 17, 14, 17, 20, 12, 20, 27, 14, 22, 9, 22]).fill(UI.muted);
    soundButton.addChild(soundIcon); this.soundText = label(soundButton, '))', 22, 11, 12, UI.muted);
    const pauseButton = button(this.root, '', 1157, 30, 38, 38, actions.pause);
    this.pauseText = label(pauseButton, 'Ⅱ', 19, 18, 18, UI.text); this.pauseText.anchor.set(0.5);
    button(this.root, '?', 1204, 30, 36, 38, actions.help);
    this.root.addChild(this.left);
    panel(this.root, 1002, 143, 238, 188);
    micro(this.root, 'TRANSMISSION', 1020, 161);
    label(this.root, 'Up next', 1020, 185, 23, UI.text, { fontWeight: '600' });
    button(this.root, 'CALL  ↓', 1152, 184, 70, 30, actions.callNext);
    this.root.addChild(this.forecast);
    this.nextTime = label(this.root, 'Awaiting your signal', 1020, 306, 11, UI.muted);
    panel(this.root, 1002, 347, 238, 110);
    micro(this.root, 'FLOW MULTIPLIER', 1020, 365);
    this.combo = label(this.root, '×1', 1020, 383, 36, UI.mint, { fontWeight: '600' });
    this.comboNote = label(this.root, 'Link 2+ packets\nto build your flow.', 1090, 395, 11, UI.muted, { lineHeight: 17 });
    panel(this.root, 1002, 473, 238, 188);
    micro(this.root, 'A CHANGE OF PERSPECTIVE', 1020, 490, UI.muted, 8);
    label(this.root, 'Reroute', 1020, 509, 22, UI.text, { fontWeight: '600' });
    this.routeText = label(this.root, '2 / 2', 1180, 516, 12, UI.mint, { fontFamily: 'Consolas, monospace' });
    this.routeButton = button(this.root, '↻  REROUTE A LANE', 1020, 558, 202, 39, actions.reroute);
    label(this.root, 'Move the front color run to the back.\nRecharges as you play.  [R]', 1020, 611, 11, UI.muted, { lineHeight: 17 });
    this.root.addChild(this.dynamic);
    this.capacity = label(this.root, '', 60, 625, 11, UI.muted);
    this.intro = micro(this.root, 'AN ARCADE PUZZLE ABOUT KEEPING THINGS MOVING', 40, 698, UI.dim, 7);
    micro(this.root, 'HEADPHONES RECOMMENDED', 1023, 698, UI.dim, 7);
  }

  private rebuildLeft() {
    const m = this.model;
    this.left.removeChildren().forEach(c => c.destroy({ children: true }));
    this.progress = undefined;
    if (m.mode === 'ready') {
      micro(this.left, 'ORDER IN THE OVERFLOW', 42, 145, UI.mint, 9);
      label(this.left, 'KEEP THE', 39, 181, 39, UI.text, { fontWeight: '700', letterSpacing: -1 });
      label(this.left, 'SIGNAL', 39, 224, 47, UI.mint, { fontWeight: '700', letterSpacing: 1 });
      label(this.left, 'ALIVE.', 39, 277, 47, UI.text, { fontWeight: '700', letterSpacing: 1 });
      label(this.left, 'Link colors. Clear the array.\nMake room for what comes next.', 42, 354, 13, UI.muted, { lineHeight: 22 });
      button(this.left, 'ESTABLISH SIGNAL  →', 42, 425, 230, 49, this.actions.start, true);
      label(this.left, '5 sectors  /  5–8 minutes  /  mouse', 43, 493, 10, UI.dim);
      button(this.left, 'How to play', 42, 521, 230, 32, this.actions.help);
    } else {
      const spec = SECTORS[m.sector];
      micro(this.left, `SECTOR  0${m.sector + 1} / 05`, 42, 145, UI.mint);
      label(this.left, spec.name, 40, 175, 25, UI.text, { fontWeight: '600', letterSpacing: -0.6 });
      label(this.left, spec.description, 42, 217, 12, UI.muted, { lineHeight: 20 });
      micro(this.left, 'TARGETS CLEARED', 42, 281, UI.muted, 9);
      this.progress = label(this.left, '00 / 30', 41, 298, 36, UI.text, { fontFamily: 'Consolas, monospace', letterSpacing: -1 });
      micro(this.left, 'YOUR JOURNEY', 42, 376, UI.dim, 8);
      for (let i = 0; i < 5; i++) {
        const t = label(this.left, `0${i + 1}`, 48 + i * 50, 400, 10, i <= m.sector ? UI.mint : UI.dim, { fontFamily: 'Consolas, monospace' });
        t.anchor.set(0.5);
      }
      micro(this.left, 'FIND YOUR FLOW', 42, 440, UI.muted, 9);
      label(this.left, '01', 42, 467, 11, UI.mint, { fontFamily: 'Consolas, monospace' });
      label(this.left, 'Select a matching packet run.', 69, 464, 11, UI.muted);
      label(this.left, '02', 42, 494, 11, UI.mint, { fontFamily: 'Consolas, monospace' });
      label(this.left, 'Click a matching front target.', 69, 491, 11, UI.muted);
      label(this.left, '03', 42, 521, 11, UI.mint, { fontFamily: 'Consolas, monospace' });
      label(this.left, 'Reroute when a color is buried.', 69, 518, 11, UI.muted);
    }
    panel(this.left, 42, 575, 230, 86, UI.inset, 12);
    micro(this.left, 'BUFFER PRESSURE', 58, 590, UI.muted, 8);
  }

  tick(dt: number, best: number, sound: boolean) {
    this.time += dt;
    const m = this.model;
    const key = `${m.mode === 'ready'}:${m.sector}`;
    if (key !== this.lastLeft) { this.lastLeft = key; this.rebuildLeft(); }
    const forecastKey = m.upcoming.join(',');
    if (forecastKey !== this.lastForecast) {
      this.lastForecast = forecastKey;
      this.forecast.removeChildren().forEach(c => c.destroy({ children: true }));
      m.upcoming.forEach((color, i) => {
        const c = chip(color, 43, i === 0); c.position.set(1043 + i * 74, 253); c.alpha = 1 - i * 0.18;
        this.forecast.addChild(c);
        const l = micro(this.forecast, i === 0 ? 'NEXT' : `0${i + 1}`, 1043 + i * 74, 283, i === 0 ? COLORS[color].hex : UI.dim, 7); l.anchor.set(0.5);
      });
    }
    this.score.text = String(m.score).padStart(6, '0');
    this.best.text = String(Math.max(best, m.score)).padStart(6, '0');
    this.status.text = m.mode === 'ready' ? '●  STANDBY' : m.mode === 'playing' ? '●  SIGNAL LIVE' : m.mode === 'paused' ? 'Ⅱ  PAUSED' : m.mode === 'lost' ? '●  SIGNAL LOST' : '●  TRANSMITTED';
    this.status.style.fill = m.mode === 'lost' ? UI.danger : UI.mint;
    this.soundText.text = sound ? '))' : '×';
    this.pauseText.text = m.mode === 'paused' ? '▷' : 'Ⅱ';
    this.combo.text = `×${m.combo}`;
    this.comboNote.text = m.combo > 1 ? `${m.combo === 5 ? 'Maximum flow!' : 'Keep the chain alive.'}\n${Math.ceil(m.comboTime)}s remaining` : 'Link 2+ packets\nto build your flow.';
    this.routeButton.alpha = m.energy >= 8 && m.mode === 'playing' ? 1 : 0.38;
    (this.routeButton.children[1] as Text).text = m.routing ? 'CHOOSE A LANE  ↗' : '↻  REROUTE A LANE';
    this.routeText.text = `${Math.floor(m.energy / 8)} / 2`;
    this.nextTime.text = m.mode === 'ready' ? 'Call a packet early when you need it.' : m.queue.length >= 10 ? `Full buffer · ${Math.max(0, 5 - m.overflowTime).toFixed(1)}s to recover` : `Next in ${(m.interval - m.arrivalTime).toFixed(1)}s  ·  Call early [N]`;
    this.nextTime.style.fill = m.queue.length >= 10 ? UI.danger : UI.muted;
    this.capacity.text = m.mode === 'ready' ? 'Keep a little breathing room.' : m.queue.length >= 10 ? 'Critical. Send a packet now.' : m.queue.length >= 8 ? 'Getting tight. Make some space.' : `${10 - m.queue.length} open slots. Keep it flowing.`;
    this.capacity.style.fill = m.queue.length >= 8 ? UI.danger : UI.muted;
    if (this.progress) this.progress.text = `${String(m.sectorCleared).padStart(2, '0')} / ${m.sectorTotal}`;
    this.intro.text = m.mode === 'ready' ? 'AN ARCADE PUZZLE ABOUT KEEPING THINGS MOVING' : `LUMEN / ${Math.floor(m.elapsed / 60)}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')} TRANSMITTING`;
    this.dynamic.clear();
    for (let i = 0; i < 10; i++) this.dynamic.roundRect(58 + i * 20, 611, 15, 5, 2).fill(i < m.queue.length ? (m.queue.length >= 8 ? UI.danger : UI.mint) : UI.line);
    this.dynamic.roundRect(1020, 297, 202, 2, 1).fill(UI.line);
    this.dynamic.roundRect(1020, 297, Math.max(1, 202 * (m.queue.length >= 10 ? 1 - m.overflowTime / 5 : m.arrivalTime / m.interval)), 2, 1).fill(m.queue.length >= 10 ? UI.danger : UI.mint);
    for (let i = 0; i < 16; i++) this.dynamic.roundRect(1020 + i * 12.8, 544, 9, 3, 1).fill(i < m.energy ? UI.mint : UI.line);
    if (m.combo > 1) this.dynamic.roundRect(1020, 444, 202 * m.comboTime / 12, 2, 1).fill(UI.mint);
    if (m.mode !== 'ready') {
      this.dynamic.roundRect(42, 349, 230, 4, 2).fill(UI.line);
      if (m.sectorCleared) this.dynamic.roundRect(42, 349, 230 * m.sectorCleared / m.sectorTotal, 4, 2).fill(UI.mint);
      for (let i = 0; i < 4; i++) line(this.dynamic, 64 + i * 50, 400, 81 + i * 50, 400, i < m.sector ? UI.mint : UI.line);
      this.dynamic.circle(48 + m.sector * 50, 400, 16).stroke({ color: UI.mint, alpha: 0.4, width: 1 });
    }
  }
}
