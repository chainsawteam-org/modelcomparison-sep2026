import { Container, Graphics, Text } from 'pixi.js';
import { Scene, type Stage } from '../core/stage';
import { Shake } from '../core/shake';
import { FxLayer } from '../fx/particles';
import { Audio } from '../audio/audio';
import { GameModel } from '../game/model';
import { BAY_COUNT, COLORS, OVERFLOW_GRACE, SLAG, UI, VIEW, waveSpec } from '../game/config';
import { BAY_H, BAY_W, BayView } from '../game/bay-view';
import { OrbView, orbSkin } from '../game/orb-view';
import { RailView } from '../game/rail-view';
import { VentView } from '../game/vent-view';
import { BANNER_Y, BAY_Y, PORT, PREVIEW_X, RAIL_Y, VENT, bayX, slotX } from '../game/layout';
import { Hud, fmt } from '../game/hud';
import { Banner } from '../ui/banner';
import { Panel } from '../ui/panel';
import { Button } from '../ui/button';
import { Save } from '../game/storage';
import { clamp, mixColor } from '../core/math';
import { orbChip } from '../game/orb-view';
import type { GameEvent } from '../game/types';
import { MenuScene } from './menu-scene';

type Target = { kind: 'bay'; index: number } | { kind: 'vent' } | null;

export class GameScene extends Scene {
  private model = new GameModel();

  private bayLayer = new Container();
  private orbLayer = new Container();
  private previewLayer = new Container();
  private uiLayer = new Container();
  private flash = new Graphics();

  private bays: BayView[] = [];
  private rail = new RailView();
  private vent = new VentView();
  private fx = new FxLayer();
  private hud: Hud;
  private banner = new Banner(BANNER_Y);
  private shake: Shake;

  private views = new Map<number, OrbView>();
  private loose: OrbView[] = [];
  private previewChips: Container[] = [];

  private selected: number | null = null;
  private hoverTarget: Target = null;
  private drag: { id: number; active: boolean; ox: number; oy: number } | null = null;
  private pointer = { x: 0, y: 0 };

  private paused = false;
  private finished = false;
  private dying = 0;
  private flashAmount = 0;
  private hitstop = 0;
  private life = 0;
  private trailClock = 0;

  private panel: Panel | null = null;
  private overflowRing = new Graphics();
  private hintText: Text;
  private soundBtn: Text;

  private onKey = (e: KeyboardEvent) => this.handleKey(e);

  constructor(stage: Stage) {
    super(stage);
    this.hud = new Hud(Save.best);
    this.shake = new Shake(stage.camera);

    for (let i = 0; i < BAY_COUNT; i++) {
      const b = new BayView(i);
      b.x = bayX(i);
      b.y = BAY_Y;
      b.intro(0.08 * i);
      b.on('pointerover', () => { this.hoverTarget = { kind: 'bay', index: i }; Audio.hover(); });
      b.on('pointerout', () => { if (this.hoverTarget?.kind === 'bay' && this.hoverTarget.index === i) this.hoverTarget = null; });
      b.on('pointertap', () => this.clickBay(i));
      this.bays.push(b);
      this.bayLayer.addChild(b);
    }

    this.vent.on('pointerover', () => { this.hoverTarget = { kind: 'vent' }; Audio.hover(); });
    this.vent.on('pointerout', () => { if (this.hoverTarget?.kind === 'vent') this.hoverTarget = null; });
    this.vent.on('pointertap', () => this.clickVent());

    this.hintText = new Text({
      text: 'CLICK OR DRAG AN ORB INTO A MATCHING BAY     ·     1-4  DEPLOY     ·     SPACE  VENT     ·     P  PAUSE',
      style: {
        fill: UI.faint, fontSize: 11, fontWeight: '700', letterSpacing: 2.2,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.hintText.anchor.set(0.5);
    this.hintText.x = VIEW.w / 2;
    this.hintText.y = 656;
    this.hintText.alpha = 0.85;

    this.soundBtn = this.makeMiniButton(Audio.muted ? 'SOUND OFF' : 'SOUND ON', VIEW.w - 46, 656, () => {
      const m = !Audio.muted;
      Audio.setMuted(m);
      Save.setMuted(m);
      this.soundBtn.text = m ? 'SOUND OFF' : 'SOUND ON';
    });
    const pauseBtn = this.makeMiniButton('PAUSE', 62, 656, () => this.togglePause());

    const intakeLabel = new Text({
      text: 'INTAKE', style: {
        fill: UI.faint, fontSize: 10, fontWeight: '700', letterSpacing: 3,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    intakeLabel.anchor.set(0.5);
    intakeLabel.x = PORT.x + 74; intakeLabel.y = RAIL_Y + 56;

    this.flash.rect(0, 0, VIEW.w, VIEW.h).fill({ color: 0xffffff });
    this.flash.alpha = 0;
    this.flash.eventMode = 'none';

    this.uiLayer.addChild(this.hintText, this.soundBtn, pauseBtn, intakeLabel);
    this.addChild(
      this.rail, this.vent, this.overflowRing, this.bayLayer, this.previewLayer,
      this.orbLayer, this.fx, this.uiLayer, this.hud, this.banner, this.flash,
    );

    for (let i = 0; i < 3; i++) {
      const c = new Container();
      c.x = PREVIEW_X[i];
      c.y = RAIL_Y;
      this.previewLayer.addChild(c);
      this.previewChips.push(c);
    }

    this.syncOrbs(true);
    this.refreshPreview();
    this.banner.show('ROUTE THE ORBS', 'Send each orb to a bay that wants its hue', UI.accent, 2.4);
  }

  // ------------------------------------------------------------------ lifecycle

  override enter(): void {
    window.addEventListener('keydown', this.onKey);
    this.stage.app.stage.on('pointermove', this.onPointerMove, this);
    this.stage.app.stage.on('pointerup', this.onPointerUp, this);
    this.stage.app.stage.on('pointerupoutside', this.onPointerUp, this);
    Audio.startMusic();
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.stage.app.stage.off('pointermove', this.onPointerMove, this);
    this.stage.app.stage.off('pointerup', this.onPointerUp, this);
    this.stage.app.stage.off('pointerupoutside', this.onPointerUp, this);
    this.fx.clear();
  }

  private makeMiniButton(label: string, x: number, y: number, action: () => void): Text {
    const t = new Text({
      text: label, style: {
        fill: UI.faint, fontSize: 11, fontWeight: '800', letterSpacing: 2.4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    t.anchor.set(0.5);
    t.x = x; t.y = y;
    t.eventMode = 'static';
    t.cursor = 'pointer';
    t.on('pointerover', () => { t.style.fill = UI.text; });
    t.on('pointerout', () => { t.style.fill = UI.faint; });
    t.on('pointertap', () => { Audio.ui(); action(); });
    return t;
  }

  // ----------------------------------------------------------------------- input

  private handleKey(e: KeyboardEvent): void {
    Audio.unlock();
    const k = e.key.toLowerCase();
    if (k === 'm') {
      const m = !Audio.muted;
      Audio.setMuted(m); Save.setMuted(m);
      this.soundBtn.text = m ? 'SOUND OFF' : 'SOUND ON';
      return;
    }
    if (this.finished) {
      if (k === 'r' || k === 'enter' || k === ' ') { e.preventDefault(); this.restart(); }
      if (k === 'escape') this.quit();
      return;
    }
    if (k === 'p' || k === 'escape') { e.preventDefault(); this.togglePause(); return; }
    if (this.paused) return;

    if (k >= '1' && k <= '4') {
      const i = Number(k) - 1;
      if (i < BAY_COUNT) this.deploy(i);
      return;
    }
    if (k === ' ' || k === 'v') { e.preventDefault(); this.tryVent(); return; }
    if (k === 'arrowleft' || k === 'a') { this.cycle(-1); return; }
    if (k === 'arrowright' || k === 'd') { this.cycle(1); return; }
  }

  private cycle(dir: number): void {
    const q = this.model.queue;
    if (!q.length) return;
    const cur = this.selected === null ? -1 : this.model.indexOf(this.selected);
    let next = cur + dir;
    if (next < 0) next = q.length - 1;
    if (next >= q.length) next = 0;
    this.select(q[next].id);
  }

  private select(id: number | null): void {
    if (this.selected === id) return;
    this.selected = id;
    if (id !== null) Audio.pick();
  }

  private onPointerMove(e: { global: { x: number; y: number } }): void {
    const p = this.toLocal(e.global);
    this.pointer.x = p.x; this.pointer.y = p.y;
    if (this.drag) {
      const view = this.views.get(this.drag.id);
      if (!view) { this.drag = null; return; }
      const dx = p.x - this.drag.ox, dy = p.y - this.drag.oy;
      if (!this.drag.active && dx * dx + dy * dy > 40) this.drag.active = true;
      if (this.drag.active) {
        view.setTarget(p.x, p.y);
        this.hoverTarget = this.targetAt(p.x, p.y);
      }
    }
  }

  private onPointerUp(): void {
    if (this.drag?.active) {
      const t = this.targetAt(this.pointer.x, this.pointer.y);
      if (t?.kind === 'bay') this.deploy(t.index);
      else if (t?.kind === 'vent') this.tryVent();
      this.drag = null;
      this.layoutQueue();
      return;
    }
    this.drag = null;
  }

  private targetAt(x: number, y: number): Target {
    for (let i = 0; i < this.bays.length; i++) {
      const bx = bayX(i);
      if (x >= bx && x <= bx + BAY_W && y >= BAY_Y && y <= BAY_Y + BAY_H) return { kind: 'bay', index: i };
    }
    const dx = x - VENT.x, dy = y - VENT.y;
    if (dx * dx + dy * dy <= (VENT.r + 10) ** 2) return { kind: 'vent' };
    return null;
  }

  private clickBay(i: number): void {
    if (this.paused || this.finished) return;
    if (this.drag?.active) return;
    this.deploy(i);
  }

  private clickVent(): void {
    if (this.paused || this.finished) return;
    if (this.drag?.active) return;
    this.tryVent();
  }

  // --------------------------------------------------------------------- actions

  private deploy(bayIndex: number): void {
    Audio.unlock();
    if (this.selected === null || this.paused || this.finished) return;
    this.handle(this.model.deploy(this.selected, bayIndex));
  }

  private tryVent(): void {
    Audio.unlock();
    if (this.selected === null || this.paused || this.finished) return;
    this.handle(this.model.ventOrb(this.selected));
  }

  // ---------------------------------------------------------------------- events

  private handle(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'spawn': {
          const existing = this.views.get(ev.orb.id);
          if (existing) {
            // It was parked at the door during an overflow; it is grabbable now.
            existing.eventMode = 'static';
          } else {
            const v = new OrbView(ev.orb, PORT.x, RAIL_Y);
            this.bindOrb(v);
            this.views.set(ev.orb.id, v);
            this.orbLayer.addChild(v);
          }
          this.rail.ping(this.model.indexOf(ev.orb.id));
          this.fx.pulse(PORT.x, RAIL_Y, orbSkin(ev.orb).main, 90, 0.28);
          Audio.spawn();
          this.refreshPreview();
          break;
        }
        case 'deliver': {
          const view = this.views.get(ev.orb.id);
          const bay = this.bays[ev.bay];
          const drop = bay.dropPoint();
          this.views.delete(ev.orb.id);
          if (view) {
            this.loose.push(view);
            view.launch(drop.x, drop.y, 0.3, () => {
              const skin = orbSkin(ev.orb);
              this.fx.burst(drop.x, drop.y, skin.main, 14, 0.9);
              this.fx.shock(drop.x, drop.y, skin.main, 150, 0.4);
              bay.hit();
              this.shake.add(3.2);
              this.removeLoose(view);
            });
          }
          Audio.deliver(ev.step);
          if (ev.points > 0) this.fx.float(drop.x + 30, drop.y - 34, `+${ev.points}`, 0xffffff, 18);
          // A twin orb dropped into a bay with one slot left loses half its cargo.
          if (ev.units < ev.orb.units) this.fx.float(drop.x - 44, drop.y - 20, 'OVERFILL', UI.faint, 13);
          this.hitstop = Math.max(this.hitstop, 0.02);
          break;
        }
        case 'complete': {
          const bay = this.bays[ev.bay];
          const p = bay.dropPoint();
          const color = COLORS[this.model.bays[ev.bay].color].main;
          bay.shipped();
          this.fx.burst(p.x, p.y, color, 34, 1.5);
          this.fx.shock(p.x, p.y, 0xffffff, 340, 0.55);
          this.fx.shock(p.x, p.y, color, 260, 0.45);
          this.fx.float(p.x, p.y - 62, `+${fmt(ev.points)}`, mixColor(color, 0xffffff, 0.5), 30);
          if (ev.chain >= 2) {
            this.fx.float(p.x, p.y - 100, `CHAIN x${ev.chain}`, UI.accent, 22);
            this.fx.shock(p.x, p.y, UI.accent, 420, 0.7);
          }
          if (ev.priority) this.fx.float(p.x, p.y + 70, 'PRIORITY x3', UI.warn, 18);
          this.shake.add(6 + Math.min(6, ev.chain * 1.6));
          this.flashAmount = Math.max(this.flashAmount, 0.1 + Math.min(0.12, ev.chain * 0.04));
          this.hitstop = Math.max(this.hitstop, 0.07);
          Audio.complete(ev.chain);
          break;
        }
        case 'reject': {
          const view = this.views.get(ev.orb.id);
          view?.nudge();
          const bay = this.bays[ev.bay];
          const p = bay.dropPoint();
          this.fx.pulse(p.x, p.y, UI.bad, 150, 0.3);
          this.fx.float(p.x, p.y + 152, ev.orb.kind === 'slag' ? 'SLAG - VENT IT' : 'WRONG HUE', UI.bad, 16);
          this.shake.add(2.2);
          Audio.reject();
          break;
        }
        case 'vent': {
          const view = this.views.get(ev.orb.id);
          this.views.delete(ev.orb.id);
          this.vent.fire();
          if (view) {
            this.loose.push(view);
            view.launch(VENT.x, VENT.y, 0.26, () => {
              const skin = orbSkin(ev.orb);
              this.fx.jet(VENT.x, VENT.y, Math.PI / 2, ev.slag ? SLAG.light : skin.main, 22);
              this.fx.burst(VENT.x, VENT.y, ev.slag ? 0xffd166 : skin.main, 16, 0.9);
              this.fx.shock(VENT.x, VENT.y, UI.warn, 190, 0.45);
              this.shake.add(5);
              this.removeLoose(view);
            });
          }
          if (ev.points > 0) this.fx.float(VENT.x, VENT.y - 70, `+${ev.points}`, UI.warn, 20);
          else if (!ev.slag) this.fx.float(VENT.x, VENT.y - 70, 'MULTIPLIER HALVED', UI.bad, 14);
          Audio.vent(ev.slag);
          break;
        }
        case 'ventBlocked': {
          this.views.get(ev.orb.id)?.nudge();
          this.fx.pulse(VENT.x, VENT.y, UI.bad, 140, 0.3);
          this.fx.float(VENT.x, VENT.y - 70, 'RECHARGING', UI.bad, 14);
          Audio.reject();
          break;
        }
        case 'expire': {
          const p = this.bays[ev.bay].dropPoint();
          this.fx.burst(p.x, p.y, 0x8a5bd6, 20, 1.1);
          this.fx.float(p.x, p.y - 60, 'ORDER LOST', UI.bad, 20);
          this.shake.add(7);
          Audio.reject();
          break;
        }
        case 'order': {
          const p = this.bays[ev.bay].dropPoint();
          const color = COLORS[this.model.bays[ev.bay].color].main;
          this.fx.pulse(p.x, p.y, color, 170, 0.35);
          break;
        }
        case 'wave': {
          const spec = waveSpec(ev.index);
          this.banner.show(`WAVE ${ev.index}  ·  ${spec.label}`, spec.note, UI.accent, 2.6);
          this.fx.shock(VIEW.w / 2, BANNER_Y, UI.accent, 900, 0.9);
          this.flashAmount = Math.max(this.flashAmount, 0.12);
          this.shake.add(5);
          Audio.wave();
          break;
        }
        case 'danger': {
          this.rail.setDanger(ev.on);
          if (ev.on) Audio.warn();
          break;
        }
        case 'multiplierLost': {
          this.fx.float(VIEW.w - 86, 96, 'MULTIPLIER LOST', UI.bad, 15);
          break;
        }
        case 'multiplierDecay': {
          this.fx.float(VIEW.w - 86, 92, `x${ev.value}`, UI.dim, 15);
          break;
        }
        case 'gameOver': {
          this.beginGameOver();
          break;
        }
      }
    }
    this.syncOrbs();
  }

  private removeLoose(view: OrbView): void {
    const i = this.loose.indexOf(view);
    if (i >= 0) this.loose.splice(i, 1);
    view.destroy({ children: true });
  }

  private bindOrb(v: OrbView): void {
    v.on('pointerdown', () => {
      Audio.unlock();
      if (this.paused || this.finished) return;
      this.select(v.orb.id);
      this.drag = { id: v.orb.id, active: false, ox: this.pointer.x, oy: this.pointer.y };
    });
    v.on('pointerover', () => v.setHover(true));
    v.on('pointerout', () => v.setHover(false));
  }

  // ----------------------------------------------------------------- view sync

  /** Create views for anything new (including the held orb) and drop stale ones. */
  private syncOrbs(snap = false): void {
    for (const orb of this.model.queue) {
      if (!this.views.has(orb.id)) {
        const v = new OrbView(orb, PORT.x, RAIL_Y);
        this.bindOrb(v);
        this.views.set(orb.id, v);
        this.orbLayer.addChild(v);
      }
    }
    const held = this.model.held;
    if (held && !this.views.has(held.id)) {
      const v = new OrbView(held, PORT.x + 60, RAIL_Y);
      this.bindOrb(v);
      v.eventMode = 'none';
      this.views.set(held.id, v);
      this.orbLayer.addChild(v);
    }

    const alive = new Set(this.model.queue.map((o) => o.id));
    if (held) alive.add(held.id);
    for (const [id, view] of [...this.views]) {
      if (!alive.has(id)) { this.views.delete(id); view.destroy({ children: true }); }
    }

    if (this.selected === null || !alive.has(this.selected) || this.model.indexOf(this.selected) < 0) {
      this.selected = this.model.queue[0]?.id ?? null;
    }
    this.layoutQueue(snap);
  }

  private layoutQueue(snap = false): void {
    this.model.queue.forEach((orb, i) => {
      const v = this.views.get(orb.id);
      if (!v || v.flying) return;
      if (this.drag?.active && this.drag.id === orb.id) return;
      v.setTarget(slotX(i), RAIL_Y, snap);
    });
    const held = this.model.held;
    if (held) this.views.get(held.id)?.setTarget(PORT.x, RAIL_Y, snap);
  }

  private refreshPreview(): void {
    this.model.upcoming.slice(0, 3).forEach((orb, i) => {
      const holder = this.previewChips[i];
      const key = String(orb.id);
      if (holder.label === key) return;
      holder.label = key;
      holder.removeChildren().forEach((c) => c.destroy({ children: true }));
      const chip = orbChip(orb, 15 - i * 1.5);
      chip.alpha = 0.85 - i * 0.2;
      holder.addChild(chip);
    });
  }

  // -------------------------------------------------------------------- endgame

  private beginGameOver(): void {
    this.finished = true;
    this.dying = 1.1;
    this.flashAmount = 0.7;
    this.shake.add(20);
    this.selected = null;
    this.drag = null;
    Audio.stopMusic();
    Audio.gameOver();
    for (const [, v] of this.views) {
      this.fx.burst(v.x, v.y, orbSkin(v.orb).main, 16, 1.2);
    }
    this.fx.shock(PORT.x, RAIL_Y, UI.bad, 1400, 1.1);
  }

  private showResults(): void {
    const s = this.model.stats;
    const previousBest = Save.best;
    Save.submit(s.score);
    const isBest = s.score > 0 && s.score > previousBest;
    this.hud.setBest(Save.best);

    const panel = new Panel({ width: 580, height: 500 });
    panel.title('DEPOT FLOODED', UI.bad, 34, -196);
    panel.caption('The intake backed up', -164, UI.dim, 13);

    const score = panel.title(fmt(s.score), UI.text, 66, -104);
    score.style.letterSpacing = 2;
    panel.caption(
      isBest ? 'NEW PERSONAL BEST' : previousBest > 0 ? `BEST  ${fmt(previousBest)}` : 'FIRST SHIFT LOGGED',
      -58, isBest ? UI.warn : UI.faint, 13,
    );

    panel.stats([
      { label: 'WAVE REACHED', value: String(s.wave), accent: UI.accent },
      { label: 'ORDERS SHIPPED', value: String(s.orders) },
      { label: 'ORBS ROUTED', value: String(s.delivered) },
      { label: 'BEST CHAIN', value: `x${s.bestChain}` },
      { label: 'PEAK MULTIPLIER', value: `x${s.bestMultiplier}`, accent: UI.warn },
      { label: 'SHIFT LENGTH', value: `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}` },
    ], -14, 420, 30);

    const retry = new Button({ label: 'RUN IT AGAIN', width: 250, color: UI.accent });
    retry.onClick = () => this.restart();
    const menu = new Button({ label: 'MENU', width: 160, ghost: true });
    menu.onClick = () => this.quit();
    panel.addButton(retry, -92, 202);
    panel.addButton(menu, 122, 202);
    panel.caption('R  RETRY      ESC  MENU', 236, UI.faint, 10, 2.6);

    this.panel = panel;
    this.addChild(panel);
  }

  private togglePause(): void {
    if (this.finished) return;
    if (this.paused) {
      this.paused = false;
      this.panel?.destroy({ children: true });
      this.panel = null;
      Audio.startMusic();
      return;
    }
    this.paused = true;
    const panel = new Panel({ width: 560, height: 470 });
    panel.title('PAUSED', UI.text, 34, -178);

    // A compact legend doubles as the rulebook — no separate tutorial screen.
    const legend = new Container();
    const entries: { orb: Parameters<typeof orbChip>[0]; title: string; body: string }[] = [
      { orb: { id: -1, kind: 'normal', color: 0, units: 1 }, title: 'HUED ORB', body: 'Fits any bay asking for that hue' },
      { orb: { id: -2, kind: 'twin', color: 3, units: 2 }, title: 'TWIN ORB', body: 'Fills two units at once' },
      { orb: { id: -3, kind: 'prism', color: -1, units: 1 }, title: 'PRISM', body: 'Wildcard — every bay accepts it' },
      { orb: { id: -4, kind: 'slag', color: -1, units: 1 }, title: 'SLAG', body: 'No bay takes it. Vent it.' },
    ];
    entries.forEach((e, i) => {
      const row = new Container();
      row.y = i * 52;
      const chip = orbChip(e.orb, 18);
      chip.x = -190;
      const t = new Text({
        text: e.title, style: {
          fill: UI.text, fontSize: 14, fontWeight: '800', letterSpacing: 2,
          fontFamily: 'Segoe UI, system-ui, sans-serif',
        },
      });
      t.anchor.set(0, 0.5); t.x = -156; t.y = -9;
      const b = new Text({
        text: e.body, style: {
          fill: UI.dim, fontSize: 12, fontWeight: '600',
          fontFamily: 'Segoe UI, system-ui, sans-serif',
        },
      });
      b.anchor.set(0, 0.5); b.x = -156; b.y = 9;
      row.addChild(chip, t, b);
      legend.addChild(row);
    });
    legend.y = -104;
    panel.add(legend);

    panel.caption('MULTIPLIER RISES WITH EVERY ORDER · CHAIN ORDERS WITHIN 3s FOR BONUSES', 132, UI.faint, 11, 1.6);
    panel.caption('IF THE RAIL FILLS YOU HAVE 3 SECONDS BEFORE THE DEPOT FLOODS', 152, UI.faint, 11, 1.6);

    const resume = new Button({ label: 'RESUME', width: 220, color: UI.good });
    resume.onClick = () => this.togglePause();
    const quit = new Button({ label: 'QUIT', width: 140, ghost: true });
    quit.onClick = () => this.quit();
    panel.addButton(resume, -78, 200);
    panel.addButton(quit, 112, 200);

    this.panel = panel;
    this.addChild(panel);
    Audio.stopMusic();
  }

  private restart(): void {
    this.stage.go((s) => new GameScene(s));
  }

  private quit(): void {
    this.stage.go((s) => new MenuScene(s));
  }

  // ---------------------------------------------------------------------- update

  override update(dt: number): void {
    this.life += dt;
    this.shake.update(dt);
    this.panel?.update(dt);

    const running = !this.paused && !this.finished;
    if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - dt);
    const gdt = this.hitstop > 0 ? dt * 0.12 : dt;

    if (running) {
      this.handle(this.model.update(gdt));
      const heat = clamp(this.model.pressure * 0.8 + (this.model.waveIndex - 1) * 0.05, 0, 1);
      Audio.setIntensity(heat);
      this.stage.ambient?.setHeat(Math.max(0, this.model.pressure - 0.45) * 1.4);
    }

    if (this.dying > 0) {
      this.dying -= dt;
      if (this.dying <= 0 && !this.panel) this.showResults();
    }

    // --- highlight state
    const sel = this.selected !== null ? this.model.queue.find((o) => o.id === this.selected) : undefined;
    for (let i = 0; i < this.bays.length; i++) {
      const bay = this.model.bays[i];
      const view = this.bays[i];
      view.sync(bay);
      view.setHighlight(!!sel && this.model.canAccept(sel, bay));
      view.setHover(this.hoverTarget?.kind === 'bay' && this.hoverTarget.index === i);
      view.update(running || this.finished ? gdt : dt * 0.25, bay);
    }
    // The vent only lights up when it is genuinely the right move: the held orb
    // is slag, or nothing on the board will take it.
    const ventWorthy = !!sel && (sel.kind === 'slag' || this.model.suggestBay(sel) < 0);
    this.vent.setHighlight(ventWorthy && this.vent.isReady);
    this.vent.setHover(this.hoverTarget?.kind === 'vent');
    this.vent.update(dt, this.model.incinerator, this.model.ventMax);

    // --- orbs
    for (const [id, v] of this.views) {
      v.setSelected(id === this.selected);
      const dimmed = this.model.suggestBay(v.orb) < 0 && v.orb.kind !== 'prism';
      v.setDim(dimmed ? 0.5 : 0);
      v.update(dt);
    }
    this.trailClock += dt;
    for (const v of this.loose) {
      v.update(dt);
      if (this.trailClock > 0.016) {
        const p = v.trailPoint();
        if (p) this.fx.trail(p.x, p.y, p.color);
      }
    }
    if (this.trailClock > 0.016) this.trailClock = 0;

    // --- rail + gauge
    this.rail.setPressure(this.model.pressure);
    this.rail.update(dt, this.model.queue.length, this.model.held ? this.model.overflow : 0);

    // --- overflow countdown at the port
    const ring = this.overflowRing;
    ring.clear();
    if (this.model.held && !this.finished) {
      const t = clamp(1 - this.model.overflow / OVERFLOW_GRACE, 0, 1);
      ring.arc(PORT.x, RAIL_Y, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t)
        .stroke({ width: 6, color: UI.bad, alpha: 0.9 });
      if (Math.sin(this.life * 16) > 0) {
        ring.circle(PORT.x, RAIL_Y, 52).stroke({ width: 2, color: UI.bad, alpha: 0.5 });
      }
      if (!this.banner.visible || this.bannerCooldown <= 0) {
        this.banner.show('RAIL FULL', 'Clear a slot before the depot floods', UI.bad, 1.4);
        this.bannerCooldown = 1.5;
      }
    }
    this.bannerCooldown -= dt;

    // --- hud
    this.hud.setScore(this.model.score);
    this.hud.setMultiplier(this.model.multiplier);
    this.hud.setChain(this.model.chain);
    this.hud.setFlow(this.model.flowLeft);
    this.hud.setWave(this.model.waveIndex, this.model.spec.label, this.model.waveProgress);
    this.hud.update(dt);
    this.banner.update(dt);
    this.fx.update(dt);

    this.flashAmount = Math.max(0, this.flashAmount - dt * 2.4);
    this.flash.alpha = this.flashAmount * 0.5;

    this.hintText.alpha = clamp(1.2 - this.life * 0.04, 0.35, 0.9);
  }

  private bannerCooldown = 0;

  override resize(): void {
    this.shake.setOrigin(0, 0);
  }
}
