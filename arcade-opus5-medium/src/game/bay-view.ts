import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { COLORS, UI } from './config';
import { glowTexture, orbTexture } from '../core/textures';
import { clamp, damp, easeOutCubic, mixColor } from '../core/math';
import type { Bay } from './types';

export const BAY_W = 262;
export const BAY_H = 234;

const KEYS = ['1', '2', '3', '4'];

/**
 * One order card. It shows the hue it wants, how many units are still missing,
 * and — for priority orders — how long is left before it jams.
 */
export class BayView extends Container {
  private frame = new Graphics();
  private glow = new Sprite(glowTexture());
  private targetOrb = new Sprite(orbTexture());
  private targetGlow = new Sprite(glowTexture());
  private glyph: Text;
  private title: Text;
  private countText: Text;
  private statusText: Text;
  private keyHint: Text;
  private pips = new Container();
  private timerArc = new Graphics();
  private hlRing = new Graphics();
  private content = new Container();

  private lastKey = '';
  private highlight = 0;
  private highlightTarget = 0;
  private hover = 0;
  private hoverTarget = 0;
  private punch = 0;
  private shipFlash = 0;
  private life = 0;
  private introT = 0;

  constructor(readonly index: number) {
    super();
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.width = this.glow.height = BAY_W * 1.9;
    this.glow.x = BAY_W / 2; this.glow.y = BAY_H / 2;
    this.glow.alpha = 0;

    this.targetGlow.anchor.set(0.5);
    this.targetGlow.blendMode = 'add';
    this.targetGlow.width = this.targetGlow.height = 190;
    this.targetGlow.x = BAY_W / 2; this.targetGlow.y = 96;

    this.targetOrb.anchor.set(0.5);
    this.targetOrb.width = this.targetOrb.height = 76;
    this.targetOrb.x = BAY_W / 2; this.targetOrb.y = 96;

    this.glyph = new Text({
      text: '', style: {
        fill: 0xffffff, fontSize: 28, fontWeight: '700',
        fontFamily: 'Segoe UI Symbol, Segoe UI, system-ui, sans-serif',
      },
    });
    this.glyph.anchor.set(0.5);
    this.glyph.x = BAY_W / 2; this.glyph.y = 96;
    this.glyph.alpha = 0.92;

    this.title = new Text({
      text: '', style: {
        fill: UI.dim, fontSize: 12, fontWeight: '700', letterSpacing: 3,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.title.anchor.set(0.5, 0);
    this.title.x = BAY_W / 2; this.title.y = 22;

    this.countText = new Text({
      text: '', style: {
        fill: UI.text, fontSize: 15, fontWeight: '800', letterSpacing: 1,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.countText.anchor.set(0.5, 0);
    this.countText.x = BAY_W / 2; this.countText.y = 190;

    this.statusText = new Text({
      text: '', style: {
        fill: UI.warn, fontSize: 22, fontWeight: '800', letterSpacing: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.statusText.anchor.set(0.5);
    this.statusText.x = BAY_W / 2; this.statusText.y = BAY_H / 2;
    this.statusText.alpha = 0;

    this.keyHint = new Text({
      text: KEYS[index] ?? '', style: {
        fill: UI.faint, fontSize: 13, fontWeight: '800',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.keyHint.anchor.set(0.5);
    this.keyHint.x = 22; this.keyHint.y = 22;

    this.pips.x = 0; this.pips.y = 156;

    this.content.addChild(
      this.glow, this.frame, this.hlRing, this.timerArc, this.targetGlow, this.targetOrb,
      this.glyph, this.title, this.countText, this.pips, this.keyHint, this.statusText,
    );
    this.addChild(this.content);

    // pivot at the card centre so hover/punch scale from the middle
    this.content.pivot.set(BAY_W / 2, BAY_H / 2);
    this.content.x = BAY_W / 2;
    this.content.y = BAY_H / 2;

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = { contains: (x: number, y: number) => x >= 0 && x <= BAY_W && y >= 0 && y <= BAY_H };
  }

  /** Cards fan in when the round starts. */
  intro(delay: number): void { this.introT = -delay; }

  setHover(v: boolean): void { this.hoverTarget = v ? 1 : 0; }
  /** Lit up when the currently held orb can be delivered here. */
  setHighlight(v: boolean): void { this.highlightTarget = v ? 1 : 0; }
  /** Impact response when an orb lands. */
  hit(): void { this.punch = 1; }
  shipped(): void { this.shipFlash = 1; this.punch = 1.3; }

  sync(bay: Bay): void {
    const color = COLORS[bay.color] ?? COLORS[0];
    const key = `${bay.orderId}|${bay.state}|${bay.filled}|${bay.required}|${bay.priority}`;
    if (key === this.lastKey) return;
    const orderChanged = !this.lastKey.startsWith(`${bay.orderId}|`);
    this.lastKey = key;

    const jam = bay.state === 'jammed';
    const shipping = bay.state === 'shipping';

    this.targetOrb.tint = jam ? 0x39406b : color.main;
    this.targetGlow.tint = color.light;
    this.targetGlow.alpha = jam ? 0.06 : 0.45;
    this.glyph.text = color.glyph;
    this.glyph.alpha = jam ? 0.25 : 0.92;

    this.title.text = bay.priority ? 'PRIORITY  x3' : color.name.toUpperCase();
    this.title.style.fill = bay.priority ? UI.warn : UI.dim;

    const left = Math.max(0, bay.required - bay.filled);
    this.countText.text = jam || shipping ? '' : `NEED ${left}`;
    this.countText.style.fill = left <= 1 ? UI.accent : UI.text;

    this.statusText.text = jam ? 'JAMMED' : shipping ? 'SHIPPED' : '';
    this.statusText.style.fill = jam ? UI.bad : UI.good;
    this.statusText.alpha = jam || shipping ? 1 : 0;

    this.buildPips(bay, color.main, jam);
    this.drawFrame(bay, color.main);
    if (orderChanged) this.introT = Math.min(this.introT, 0.55);
  }

  private buildPips(bay: Bay, color: number, jam: boolean): void {
    this.pips.removeChildren().forEach((c) => c.destroy());
    if (jam || bay.state === 'shipping') return;
    const n = bay.required;
    const gap = 8;
    const w = clamp((BAY_W - 64 - gap * (n - 1)) / n, 12, 34);
    const total = n * w + (n - 1) * gap;
    const x0 = (BAY_W - total) / 2;
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      const filled = i < bay.filled;
      g.roundRect(x0 + i * (w + gap), 0, w, 13, 6.5);
      g.fill({ color: filled ? color : 0x232a52, alpha: filled ? 1 : 0.95 });
      g.roundRect(x0 + i * (w + gap), 0, w, 13, 6.5).stroke({
        width: 1.5,
        color: filled ? mixColor(color, 0xffffff, 0.65) : 0x39427a,
        alpha: filled ? 0.95 : 0.85,
      });
      this.pips.addChild(g);
    }
  }

  private drawFrame(bay: Bay, color: number): void {
    const g = this.frame;
    g.clear();
    const jam = bay.state === 'jammed';
    const body = jam ? 0x191c33 : UI.panel;
    g.roundRect(0, 0, BAY_W, BAY_H, 18).fill({ color: body, alpha: 0.96 });
    // inner sheen
    g.roundRect(2, 2, BAY_W - 4, BAY_H * 0.5, 16).fill({ color: mixColor(body, color, 0.10), alpha: 0.5 });
    g.roundRect(0, 0, BAY_W, BAY_H, 18).stroke({
      width: 2, color: jam ? 0x3a2140 : mixColor(UI.line, color, 0.45), alpha: 0.95,
    });
    // colour tab along the top edge
    if (!jam) {
      g.roundRect(BAY_W / 2 - 52, -2, 104, 8, 4).fill({ color, alpha: 0.95 });
    }
    if (jam) {
      for (let i = -2; i <= 6; i++) {
        g.moveTo(i * 40 - 30, BAY_H).lineTo(i * 40 + 40, 0);
      }
      g.stroke({ width: 10, color: 0x2a2038, alpha: 0.55 });
    }
  }

  update(dt: number, bay: Bay): void {
    this.life += dt;
    this.introT = Math.min(1, this.introT + dt * 2.4);

    this.highlight = damp(this.highlight, this.highlightTarget, 14, dt);
    this.hover = damp(this.hover, this.hoverTarget, 16, dt);
    this.punch = Math.max(0, this.punch - dt * 3.6);
    this.shipFlash = Math.max(0, this.shipFlash - dt * 2.2);

    const intro = this.introT <= 0 ? 0 : easeOutCubic(this.introT);
    this.content.alpha = intro;
    const s = intro * (1 + this.hover * 0.02 + this.highlight * 0.02 + this.punch * 0.05);
    this.content.scale.set(s);
    this.content.y = BAY_H / 2 + (1 - intro) * 26;

    const color = (COLORS[bay.color] ?? COLORS[0]).main;
    const pulse = 0.5 + Math.sin(this.life * 6) * 0.5;
    this.glow.tint = this.shipFlash > 0 ? 0xffffff : color;
    this.glow.alpha = this.shipFlash * 0.55 + this.highlight * (0.16 + pulse * 0.13) + this.hover * 0.08;

    // urgency: near-complete orders and expiring timers breathe
    const urgent = bay.priority && bay.state === 'active' && bay.timeMax > 0 && bay.timeLeft / bay.timeMax < 0.35;
    if (urgent) {
      const b = 0.5 + Math.sin(this.life * 12) * 0.5;
      this.glow.tint = mixColor(color, UI.bad, 0.6);
      this.glow.alpha = Math.max(this.glow.alpha, 0.12 + b * 0.2);
    }

    this.targetOrb.scale.set((76 / this.targetOrb.texture.width) * (1 + this.punch * 0.1 + this.highlight * 0.04));
    this.targetGlow.width = this.targetGlow.height = 190 * (1 + this.punch * 0.15);

    // priority countdown, drawn as a shrinking bar under the header
    this.timerArc.clear();
    if (bay.state === 'active' && bay.priority && bay.timeMax > 0) {
      const t = clamp(bay.timeLeft / bay.timeMax, 0, 1);
      const w = (BAY_W - 48) * t;
      const col = t < 0.3 ? UI.bad : t < 0.6 ? UI.warn : UI.accent;
      this.timerArc.roundRect(24, 44, BAY_W - 48, 5, 2.5).fill({ color: 0x232a52, alpha: 0.9 });
      if (w > 2) this.timerArc.roundRect(24, 44, w, 5, 2.5).fill({ color: col, alpha: 1 });
    } else if (bay.state === 'jammed') {
      const t = clamp(bay.stateTimer / 3.4, 0, 1);
      this.timerArc.roundRect(24, 44, (BAY_W - 48) * t, 5, 2.5).fill({ color: 0x5a3a72, alpha: 0.9 });
    }

    // highlight frame + intake arrow when the held orb fits here
    const h = this.hlRing;
    h.clear();
    if (this.highlight > 0.02) {
      const a = this.highlight * (0.55 + pulse * 0.45);
      h.roundRect(-3, -3, BAY_W + 6, BAY_H + 6, 21)
        .stroke({ width: 3, color: mixColor(color, 0xffffff, 0.35), alpha: a });
      const ay = BAY_H + 12 + Math.sin(this.life * 6) * 4;
      h.moveTo(BAY_W / 2 - 13, ay + 10).lineTo(BAY_W / 2, ay).lineTo(BAY_W / 2 + 13, ay + 10)
        .stroke({ width: 4, color: mixColor(color, 0xffffff, 0.5), alpha: a });
    }

    if (this.statusText.alpha > 0) {
      this.statusText.scale.set(1 + this.punch * 0.14);
      this.statusText.y = BAY_H / 2 + Math.sin(this.life * 4) * (bay.state === 'jammed' ? 1.5 : 0);
    }
  }

  /** World-space centre of the receiving orb, used as the flight target. */
  dropPoint(): { x: number; y: number } {
    return { x: this.x + BAY_W / 2, y: this.y + 96 };
  }
}
