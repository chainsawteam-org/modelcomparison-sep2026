import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import { Sound } from './audio';
import { BoardView } from './board';
import { COLORS, HEIGHT, SECTORS, UI, WIDTH, laneX } from './config';
import { button, chip, label, line, micro, panel, symbol } from './draw';
import { Effects } from './effects';
import { Hud } from './hud';
import { GameModel, type Mode } from './model';
import { readSave, writeSave } from './storage';

export class Game {
  readonly model = new GameModel();
  readonly root = new Container();
  private sound = new Sound();
  private save = readSave();
  private effects = new Effects();
  private board: BoardView;
  private hud: Hud;
  private overlay = new Container();
  private atmosphere = new Graphics();
  private helpOpen = false;
  private helpPrevious: Mode = 'ready';
  private overlayKey = '';
  private now = 0;
  private lastFrame = performance.now();
  private displayMessage = '';
  private messageTime = 0;
  private toast: Text;
  private toastBg = new Graphics();
  private hasSelected = false;
  private hint: Text;
  private winsRecorded = false;
  private sessionBest = this.save.best;
  private latestAnnouncement = '';
  private liveRegion: HTMLDivElement;

  constructor(private app: Application) {
    this.sound.enabled = this.save.sound;
    app.stage.addChild(this.root);
    this.drawBackground();
    this.root.addChild(this.atmosphere);
    this.board = new BoardView(this.model, i => this.clickLane(i), i => this.clickPacket(i));
    this.hud = new Hud(this.model, {
      start: () => this.start(), pause: () => this.togglePause(), help: () => this.help(),
      sound: () => this.toggleSound(), reroute: () => this.reroute(),
      callNext: () => this.callNext(),
    });
    this.root.addChild(this.board.root, this.hud.root, this.effects.root);
    this.hint = label(this.root, '', 640, 520, 11, UI.mint, { letterSpacing: 0.5 }); this.hint.anchor.set(0.5);
    this.root.addChild(this.toastBg);
    this.toast = label(this.root, '', 640, 109, 12, UI.text, { fontWeight: '600' }); this.toast.anchor.set(0.5);
    this.root.addChild(this.overlay);
    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
    document.body.appendChild(this.liveRegion);
    app.canvas.setAttribute('aria-label', 'Lumen. Enter to start. Select packets with 1 through 0, then launch into lanes with A S D F G H. R to reroute. P to pause. Question mark for help.');
    app.canvas.setAttribute('role', 'application'); app.canvas.tabIndex = 0;
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.model.mode === 'playing') this.pause(); });
    window.addEventListener('blur', () => { if (this.model.mode === 'playing') this.pause(); });
    this.resize();
    app.ticker.add(() => {
      const time = performance.now();
      const rawDt = (time - this.lastFrame) / 1000;
      this.lastFrame = time;
      if (rawDt > 1 && this.model.mode === 'playing') this.pause();
      this.tick(Math.min(rawDt, 0.1));
    });
  }

  private drawBackground() {
    const g = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(UI.bg);
    // Quiet technical grid and an atmospheric glow, drawn entirely in Pixi.
    for (let x = 0; x < WIDTH; x += 32) for (let y = 0; y < HEIGHT; y += 32)
      g.circle(x, y, 0.55).fill({ color: 0x547391, alpha: 0.16 });
    for (let i = 15; i >= 1; i--) g.ellipse(639, 329, 135 + i * 25, 68 + i * 17).fill({ color: 0x21636c, alpha: 0.003 });
    line(g, 294, 114, 294, 662, UI.line, 0.25);
    line(g, 986, 114, 986, 662, UI.line, 0.25);
    this.root.addChild(g);
  }

  private resize = () => {
    const width = window.innerWidth, height = window.innerHeight;
    this.app.renderer.resize(width, height);
    const scale = Math.min(width / WIDTH, height / HEIGHT);
    this.root.scale.set(scale);
    this.root.position.set((width - WIDTH * scale) / 2, (height - HEIGHT * scale) / 2);
  };

  private announce(value: string) {
    if (this.latestAnnouncement !== value) { this.latestAnnouncement = value; this.liveRegion.textContent = value; }
  }

  private start() {
    this.sound.unlock(); this.model.start(); this.sound.route();
    this.app.canvas.focus();
    this.announce('Signal live. Select a packet from the buffer, then click a matching bottom target.');
  }

  private clickPacket(index: number) {
    if (this.helpOpen) return;
    if (this.model.mode === 'ready') this.start();
    if (this.model.mode !== 'playing') return;
    if (!this.model.queue[index]) return;
    this.sound.unlock(); this.model.select(index); this.hasSelected = true;
    const selected = this.model.selected;
    this.sound.select(selected[0].color);
    this.announce(`${selected.length} ${COLORS[selected[0].color].name} packets selected. Choose a matching lane.`);
  }

  private clickLane(index: number) {
    if (this.helpOpen || this.model.mode !== 'playing') return;
    this.sound.unlock();
    if (this.model.routing) {
      if (!this.model.launch(index)) this.message('That lane has no different color to reveal.');
      return;
    }
    if (!this.model.selected.length) { this.message('First, select a color from your packet buffer.'); return; }
    if (!this.model.launch(index)) { this.sound.error(); this.message('Match the color of the bottom target.'); }
  }

  private reroute() {
    if (this.helpOpen || this.model.mode !== 'playing') return;
    this.sound.unlock();
    if (this.model.toggleReroute()) this.sound.tone(440, 0.08);
    else this.message('Reroute is recharging. Clear targets to charge it faster.');
  }

  private callNext() {
    if (this.helpOpen || this.model.mode !== 'playing') return;
    this.sound.unlock();
    if (!this.model.callNext()) this.message('Buffer full. Launch a packet to make room.');
  }

  private message(value: string) { this.displayMessage = value; this.messageTime = 3; this.announce(value); }

  private toggleSound() {
    this.sound.unlock(); this.sound.enabled = !this.sound.enabled;
    this.save.sound = this.sound.enabled; writeSave(this.save);
    if (this.sound.enabled) this.sound.select(0);
    this.overlayKey = '';
  }

  private pause() { this.model.mode = 'paused'; this.announce('Signal paused.'); }

  private togglePause() {
    if (this.helpOpen) { this.closeHelp(); return; }
    if (this.model.mode === 'playing') this.pause();
    else if (this.model.mode === 'paused') { this.model.mode = 'playing'; this.app.canvas.focus(); }
  }

  private help() {
    if (this.helpOpen) { this.closeHelp(); return; }
    this.helpPrevious = this.model.mode;
    if (this.model.mode === 'playing') this.pause();
    this.helpOpen = true;
  }

  private closeHelp() { this.helpOpen = false; this.model.mode = this.helpPrevious; this.app.canvas.focus(); }

  private restart() {
    this.sound.unlock(); this.model.restart(); this.board.reset(); this.effects.clear();
    this.hasSelected = false; this.winsRecorded = false; this.helpOpen = false;
    this.messageTime = 0; this.sessionBest = this.save.best; this.app.canvas.focus(); this.sound.route();
    this.announce('New signal. Sector one. Select a packet and send it to a matching lane.');
  }

  private nextSector() {
    this.model.nextSector(); this.board.reset(); this.effects.clear(); this.messageTime = 0;
    this.sound.route(); this.app.canvas.focus();
    this.announce(`Sector ${this.model.sector + 1}. ${SECTORS[this.model.sector].name}. ${SECTORS[this.model.sector].description}`);
  }

  private onKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if ([' ', 'escape', 'enter', 'p', 'r', 'n', 'm', '?', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'a', 's', 'd', 'f', 'g', 'h'].includes(key)) event.preventDefault();
    this.sound.unlock();
    if (key === 'm') { this.toggleSound(); return; }
    if (key === '?') { this.help(); return; }
    if (this.helpOpen) { if (key === 'escape' || key === 'enter') this.closeHelp(); return; }
    if (key === 'escape') {
      if (this.model.routing || this.model.selected.length) { this.model.routing = false; this.model.selectedId = null; }
      else this.togglePause(); return;
    }
    if (key === 'p' || key === ' ') { this.togglePause(); return; }
    if (key === 'enter') {
      if (this.model.mode === 'ready') this.start();
      else if (this.model.mode === 'sectorEnd') this.nextSector();
      else if (this.model.mode === 'lost' || this.model.mode === 'won') this.restart();
      else if (this.model.mode === 'paused') this.togglePause();
      return;
    }
    if (key === 'r') this.reroute();
    if (key === 'n') this.callNext();
    if (/^[0-9]$/.test(key)) this.clickPacket(key === '0' ? 9 : Number(key) - 1);
    const lane = ['a', 's', 'd', 'f', 'g', 'h'].indexOf(key);
    if (lane >= 0) this.clickLane(lane);
  };

  private tick(dt: number) {
    this.now += dt;
    this.model.tick(dt);
    const events = this.model.events.splice(0);
    for (const event of events) {
      if (event.type === 'arrival') this.sound.arrival();
      if (event.type === 'warning') this.sound.warning();
      if (event.type === 'launch') {
        this.effects.launch(event); this.sound.launch(event.chain, event.hits[0].color);
        if (this.model.score > this.save.best) { this.save.best = this.model.score; writeSave(this.save); }
        this.announce(`${event.hits.filter(h => h.destroyed).length} targets cleared. Score ${this.model.score}. ${this.model.queue.length} of 10 buffer slots used.`);
      }
      if (event.type === 'reroute') { this.sound.route(); this.effects.float('REROUTED', laneX(event.lane), 183, UI.mint, 12); }
      if (event.type === 'sector' || event.type === 'end') {
        this.sound.finish(event.type === 'sector' || event.won);
        this.save.best = Math.max(this.save.best, this.model.score);
        if (event.type === 'end' && event.won && !this.winsRecorded) { this.save.wins++; this.winsRecorded = true; }
        writeSave(this.save);
        this.announce(event.type === 'sector' ? 'Sector complete. Continue to the next sector.' : event.won ? 'Signal complete. All five sectors cleared.' : 'Signal lost. The buffer overflowed. Try again.');
      }
    }
    this.board.tick(dt, this.save.reducedMotion);
    this.hud.tick(dt, this.save.best, this.sound.enabled);
    this.effects.tick(dt, this.save.reducedMotion);
    this.hint.text = this.model.mode === 'playing' && this.model.totalLaunched === 0
      ? this.hasSelected ? '↑  Now click a matching front target  ↑' : '↓  Start here: click the linked mint packets  ↓' : '';
    this.hint.alpha = this.save.reducedMotion ? 1 : 0.7 + Math.sin(this.now * 3) * 0.2;
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.toast.text = this.messageTime > 0 ? this.displayMessage : '';
    this.toast.alpha = Math.min(1, this.messageTime * 3);
    this.toastBg.clear();
    if (this.messageTime > 0) this.toastBg.roundRect(640 - this.toast.width / 2 - 18, 95, this.toast.width + 36, 28, 8).fill({ color: 0x24374b, alpha: this.toast.alpha });
    this.atmosphere.clear();
    if (!this.save.reducedMotion) {
      for (let i = 0; i < 18; i++) {
        const x = 300 + ((i * 131.3 + Math.sin(this.now * 0.12 + i) * 30) % 680);
        const y = 110 + ((i * 53 - this.now * (3 + i % 3)) % 540 + 540) % 540;
        this.atmosphere.circle(x, y, 1).fill({ color: UI.mint, alpha: 0.12 });
      }
    }
    const key = `${this.helpOpen}:${this.model.mode}:${this.model.sector}:${this.save.sound}:${this.save.reducedMotion}`;
    if (key !== this.overlayKey) { this.overlayKey = key; this.rebuildOverlay(); }
  }

  private stat(parent: Container, title: string, value: string, x: number, y: number, width = 156) {
    panel(parent, x, y, width, 81, UI.inset, 10);
    micro(parent, title, x + 16, y + 14, UI.muted, 8);
    label(parent, value, x + 16, y + 33, 27, UI.text, { fontFamily: 'Consolas, monospace', fontWeight: '600' });
  }

  private rebuildOverlay() {
    this.overlay.removeChildren().forEach(c => c.destroy({ children: true }));
    const m = this.model;
    if (!this.helpOpen && (m.mode === 'playing' || m.mode === 'ready')) { this.overlay.visible = false; return; }
    this.overlay.visible = true;
    const veil = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0x040912, alpha: 0.84 });
    veil.eventMode = 'static'; veil.hitArea = new Rectangle(0, 0, WIDTH, HEIGHT); this.overlay.addChild(veil);
    const content = new Container(); this.overlay.addChild(content);
    panel(content, 327, 124, 626, 482, 0x111e2e, 20);
    const ornament = new Graphics();
    line(ornament, 369, 124, 500, 124, UI.mint, 0.8, 2); this.overlay.addChild(ornament);
    if (this.helpOpen) {
      micro(content, 'A QUICK FIELD GUIDE', 369, 154, UI.mint);
      label(content, 'Keep the signal moving.', 367, 178, 33, UI.text, { fontWeight: '600', letterSpacing: -0.8 });
      const examples = [[0, 0, 1], [0, 0, 0]];
      examples.forEach((colors, row) => colors.forEach((color, i) => {
        const c = chip(color, 31); c.position.set(388 + i * 37, 269 + row * 81); content.addChild(c);
      }));
      label(content, '01   LINK YOUR PACKETS', 505, 244, 12, UI.mint, { fontWeight: '600', letterSpacing: 1 });
      label(content, 'Click a packet in the buffer. Its same-color\nneighbors join the selection automatically.', 505, 266, 13, UI.muted, { lineHeight: 20 });
      label(content, '02   SEND THEM INTO A LANE', 505, 326, 12, UI.mint, { fontWeight: '600', letterSpacing: 1 });
      label(content, 'Click a matching bottom target. One packet, one hit.\nExtra packets stay in your buffer. A 2+ burst boosts score.', 505, 348, 12, UI.muted, { lineHeight: 20 });
      const diagram = new Graphics();
      diagram.moveTo(387, 443).lineTo(452, 443).lineTo(452, 416).stroke({ color: UI.mint, width: 2 });
      diagram.poly([447, 422, 452, 416, 457, 422]).stroke({ color: UI.mint, width: 2 });
      symbol(diagram, 1, 388, 414, 10, COLORS[1].hex); symbol(diagram, 0, 420, 414, 10, COLORS[0].hex); content.addChild(diagram);
      label(content, '03   MAKE A LITTLE ROOM', 505, 410, 12, UI.mint, { fontWeight: '600', letterSpacing: 1 });
      label(content, 'Reroute moves a lane’s front color run to the back.\nAt 10 packets, you have 5 seconds before overflow.', 505, 432, 12, UI.muted, { lineHeight: 20 });
      label(content, 'Call packets early with [N]. Later, shielded targets need 2 hits.\nClear all 5 sectors to win. Your buffer resets between sectors.', 370, 480, 12, UI.muted, { lineHeight: 17 });
      micro(content, '1–0 SELECT  /  A S D F G H SEND  /  R REROUTE  /  P PAUSE  /  M SOUND', 370, 521, UI.muted, 8);
      button(content, 'GOT IT  →', 370, 547, 541, 38, () => this.closeHelp(), true);
      return;
    }
    if (m.mode === 'paused') {
      micro(content, 'TAKE A BREATHER', 369, 157, UI.mint);
      label(content, 'Signal on hold.', 367, 192, 43, UI.text, { fontWeight: '600', letterSpacing: -1 });
      label(content, 'Your packets can wait. Pick up right where you left off.', 370, 256, 14, UI.muted);
      this.stat(content, 'CURRENT SCORE', m.score.toLocaleString(), 370, 306, 256);
      this.stat(content, 'CURRENT SECTOR', `0${m.sector + 1} / 05`, 644, 306, 267);
      button(content, `Sound: ${this.sound.enabled ? 'on' : 'off'}  [M]`, 370, 413, 256, 39, () => this.toggleSound());
      button(content, `Motion: ${this.save.reducedMotion ? 'reduced' : 'full'}`, 644, 413, 267, 39, () => { this.save.reducedMotion = !this.save.reducedMotion; writeSave(this.save); });
      button(content, 'RESUME SIGNAL  →', 370, 474, 541, 47, () => this.togglePause(), true);
      button(content, 'Start over', 370, 539, 256, 35, () => this.restart());
      button(content, 'How to play', 644, 539, 267, 35, () => this.help());
      return;
    }
    const win = m.mode === 'won', sector = m.mode === 'sectorEnd';
    micro(content, sector ? `SECTOR 0${m.sector + 1} TRANSMITTED` : win ? 'ALL FREQUENCIES ALIGNED' : 'TRANSMISSION INTERRUPTED', 369, 157, sector || win ? UI.mint : UI.danger);
    label(content, sector ? 'Beautifully connected.' : win ? 'You kept the light alive.' : 'A little too much signal.', 367, 193, win ? 37 : 39, UI.text, { fontWeight: '600', letterSpacing: -1 });
    const description = sector ? `${SECTORS[m.sector].name} complete. A new frequency is waiting.` : win ? 'Five sectors. One perfect connection. The array is clear.' : 'Your buffer overflowed. A new run is a chance to find your flow.';
    label(content, description, 370, 254, 13, UI.muted);
    this.stat(content, 'TOTAL SCORE', m.score.toLocaleString(), 370, 300, 172);
    this.stat(content, 'BEST BURST', `${m.bestChain} packets`, 554, 300, 173);
    this.stat(content, 'TARGETS CLEARED', String(m.totalCleared), 739, 300, 172);
    if (sector) {
      const next = SECTORS[m.sector + 1];
      micro(content, `UP NEXT  /  0${m.sector + 2}`, 370, 414, UI.mint, 9);
      label(content, next.name, 370, 436, 23, UI.text, { fontWeight: '600' });
      label(content, next.description, 651, 419, 12, UI.muted, { lineHeight: 20 });
      button(content, 'NEXT SECTOR  →', 370, 508, 541, 49, () => this.nextSector(), true);
      label(content, 'Buffer reset. Reroute replenished. Take your time.', 370, 573, 11, UI.dim);
    } else {
      const isBest = m.score > this.sessionBest;
      micro(content, isBest ? '✦  A NEW PERSONAL BEST' : 'EVERY RUN FINDS A NEW RHYTHM', 370, 414, isBest ? UI.mint : UI.muted, 10);
      label(content, win ? `${Math.floor(m.elapsed / 60)}m ${Math.floor(m.elapsed % 60)}s  ·  ${this.save.wins} successful transmission${this.save.wins === 1 ? '' : 's'}` : 'Try saving matching neighbors for a burst. Reroute before you run out of room.', 370, 445, 12, UI.muted, { wordWrap: true, wordWrapWidth: 530, lineHeight: 20 });
      button(content, 'ONE MORE SIGNAL  ↻', 370, 508, 541, 49, () => this.restart(), true);
      label(content, 'Your personal best is saved on this device.', 370, 573, 11, UI.dim);
    }
  }
}
