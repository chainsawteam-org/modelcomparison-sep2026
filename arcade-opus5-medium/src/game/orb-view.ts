import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { COLORS, PRISM, SLAG } from './config';
import { discTexture, glowTexture, orbTexture } from '../core/textures';
import { damp, easeOutBack, easeOutCubic, lerp, mixColor } from '../core/math';
import type { Orb } from './types';

export const ORB_R = 27;

/** Colour + glyph for any orb kind. */
export function orbSkin(orb: Orb) {
  if (orb.kind === 'slag') return SLAG;
  if (orb.kind === 'prism') return PRISM;
  return COLORS[orb.color] ?? COLORS[0];
}

/**
 * One orb on screen. Handles its own spring-to-target motion, selection and
 * hover states, and the flight arc used when it is deployed.
 */
export class OrbView extends Container {
  readonly orb: Orb;

  private glow = new Sprite(glowTexture());
  private body = new Sprite(orbTexture());
  private glyph: Text;
  private badge: Container | null = null;
  private prismRing: Graphics | null = null;
  private selectRing = new Graphics();

  private tx = 0;
  private ty = 0;
  private born = 0;
  private life = 0;
  private hover = false;
  private selected = false;
  private dim = 0;
  private lift = 0;
  private pulse = 0;

  /** Flight state, used once the orb has been dispatched. */
  private flight: { x0: number; y0: number; x1: number; y1: number; arc: number; t: number; dur: number; done: () => void } | null = null;
  flying = false;

  constructor(orb: Orb, x: number, y: number) {
    super();
    this.orb = orb;
    this.x = this.tx = x;
    this.y = this.ty = y;

    const skin = orbSkin(orb);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.tint = skin.light;
    this.glow.alpha = 0.55;
    this.glow.width = this.glow.height = ORB_R * 4.4;

    this.body.anchor.set(0.5);
    this.body.width = this.body.height = ORB_R * 2.2;
    this.body.tint = skin.main;

    this.glyph = new Text({
      text: skin.glyph,
      style: {
        fill: 0xffffff, fontSize: 20, fontWeight: '700',
        fontFamily: 'Segoe UI Symbol, Segoe UI, system-ui, sans-serif',
      },
    });
    this.glyph.anchor.set(0.5);
    this.glyph.alpha = 0.9;

    // dashed selection ring, drawn once and spun while selected
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      this.selectRing.arc(0, 0, ORB_R + 9, a0, a0 + 0.42);
    }
    this.selectRing.stroke({ width: 3, color: 0xffffff, alpha: 1 });
    this.selectRing.alpha = 0;

    this.addChild(this.glow, this.selectRing, this.body, this.glyph);

    if (orb.kind === 'twin') this.buildBadge('x2', skin.dark);
    if (orb.kind === 'slag') this.buildHazard();
    if (orb.kind === 'prism') {
      this.prismRing = new Graphics();
      this.prismRing.circle(0, 0, ORB_R + 4).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
      this.addChildAt(this.prismRing, 1);
    }

    this.eventMode = 'static';
    this.cursor = 'grab';
    this.hitArea = { contains: (x: number, y: number) => x * x + y * y <= (ORB_R + 8) ** 2 };
  }

  private buildBadge(label: string, bg: number): void {
    const c = new Container();
    const g = new Graphics();
    g.circle(0, 0, 12).fill({ color: 0x0a0d1c, alpha: 0.92 });
    g.circle(0, 0, 12).stroke({ width: 2, color: mixColor(bg, 0xffffff, 0.5), alpha: 0.95 });
    const t = new Text({
      text: label,
      style: { fill: 0xffffff, fontSize: 13, fontWeight: '800', fontFamily: 'Segoe UI, system-ui, sans-serif' },
    });
    t.anchor.set(0.5);
    c.addChild(g, t);
    c.x = ORB_R * 0.78;
    c.y = -ORB_R * 0.78;
    this.badge = c;
    this.addChild(c);
  }

  private buildHazard(): void {
    const g = new Graphics();
    for (let i = -3; i <= 3; i++) {
      g.moveTo(i * 11 - 10, -ORB_R).lineTo(i * 11 + 10, ORB_R);
    }
    g.stroke({ width: 3.5, color: 0xffd166, alpha: 0.28 });
    const mask = new Graphics().circle(0, 0, ORB_R - 2).fill({ color: 0xffffff });
    g.mask = mask;
    this.addChild(mask, g);
  }

  setTarget(x: number, y: number, snap = false): void {
    this.tx = x; this.ty = y;
    if (snap) { this.x = x; this.y = y; }
  }

  setHover(v: boolean): void { this.hover = v; }
  setSelected(v: boolean): void {
    if (v && !this.selected) this.pulse = 1;
    this.selected = v;
  }
  /** 0 = fully lit, 1 = greyed out because it cannot go anywhere useful. */
  setDim(v: number): void { this.dim = v; }

  /** Little squash-and-pop, used when an orb is refused. */
  nudge(): void { this.pulse = 1.4; }

  launch(x1: number, y1: number, dur: number, done: () => void): void {
    this.flying = true;
    this.eventMode = 'none';
    this.flight = {
      x0: this.x, y0: this.y, x1, y1,
      arc: -70 - Math.random() * 40, t: 0, dur, done,
    };
  }

  /** Emits trail embers while in flight; returns null when idle. */
  trailPoint(): { x: number; y: number; color: number } | null {
    if (!this.flying) return null;
    return { x: this.x, y: this.y, color: orbSkin(this.orb).main };
  }

  update(dt: number): void {
    this.life += dt;
    this.born = Math.min(1, this.born + dt * 3.4);

    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = easeOutCubic(f.t);
      this.x = lerp(f.x0, f.x1, e);
      this.y = lerp(f.y0, f.y1, e) + Math.sin(f.t * Math.PI) * f.arc;
      const s = lerp(1, 0.55, f.t * f.t);
      this.scale.set(s);
      this.alpha = f.t > 0.85 ? 1 - (f.t - 0.85) / 0.15 : 1;
      if (f.t >= 1) { const cb = f.done; this.flight = null; this.flying = false; cb(); }
      return;
    }

    // spring toward the slot position
    this.x = damp(this.x, this.tx, 16, dt);
    this.y = damp(this.y, this.ty + (this.hover || this.selected ? -8 : 0), 18, dt);

    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    this.lift = damp(this.lift, this.selected ? 1 : this.hover ? 0.45 : 0, 14, dt);

    const pop = this.born < 1 ? easeOutBack(this.born) : 1;
    const bob = Math.sin(this.life * 2.1 + this.tx * 0.01) * 0.012;
    const s = pop * (1 + this.lift * 0.13 + this.pulse * 0.22 + bob);
    this.scale.set(s);

    const skin = orbSkin(this.orb);
    const glowBase = 0.42 + this.lift * 0.5 + this.pulse * 0.4;
    this.glow.alpha = (glowBase + Math.sin(this.life * 3.4) * 0.05) * (1 - this.dim * 0.65);
    this.glow.width = this.glow.height = ORB_R * (4.2 + this.lift * 1.5 + this.pulse * 1.4);

    if (this.orb.kind === 'prism' && this.prismRing) {
      // Prisms cycle through the palette so their wildcard nature is obvious.
      const k = (this.life * 0.9) % COLORS.length;
      const a = COLORS[Math.floor(k)].main;
      const b = COLORS[(Math.floor(k) + 1) % COLORS.length].main;
      const c = mixColor(a, b, k % 1);
      this.body.tint = mixColor(0xffffff, c, 0.55);
      this.glow.tint = c;
      this.prismRing.rotation = this.life * 1.6;
      this.prismRing.alpha = 0.5 + Math.sin(this.life * 5) * 0.25;
    } else {
      this.body.tint = this.dim > 0 ? mixColor(skin.main, 0x3a4066, this.dim * 0.7) : skin.main;
    }

    const selA = this.selected ? 0.55 + Math.sin(this.life * 7) * 0.25 : 0;
    this.selectRing.alpha = damp(this.selectRing.alpha, selA, 18, dt);
    this.selectRing.rotation += dt * (this.selected ? 1.1 : 0.2);
    this.selectRing.tint = this.orb.kind === 'slag' ? 0xffd166 : orbSkin(this.orb).light;

    this.alpha = 1 - this.dim * 0.35;
    this.glyph.alpha = 0.9 - this.dim * 0.4;
    if (this.badge) this.badge.rotation = Math.sin(this.life * 3) * 0.08;
  }

}

/** Small static orb used for previews and legends. */
export function orbChip(orb: Orb, radius: number): Container {
  const c = new Container();
  const skin = orbSkin(orb);
  const glow = new Sprite(glowTexture());
  glow.anchor.set(0.5);
  glow.blendMode = 'add';
  glow.tint = skin.light;
  glow.alpha = 0.4;
  glow.width = glow.height = radius * 4;
  const body = new Sprite(orbTexture());
  body.anchor.set(0.5);
  body.width = body.height = radius * 2.2;
  body.tint = skin.main;
  const t = new Text({
    text: skin.glyph,
    style: {
      fill: 0xffffff, fontSize: Math.round(radius * 0.78), fontWeight: '700',
      fontFamily: 'Segoe UI Symbol, Segoe UI, system-ui, sans-serif',
    },
  });
  t.anchor.set(0.5);
  t.alpha = 0.9;
  c.addChild(glow, body, t);
  if (orb.kind === 'twin') {
    const dot = new Sprite(discTexture());
    dot.anchor.set(0.5);
    dot.tint = 0xffffff;
    dot.width = dot.height = radius * 0.4;
    dot.x = radius * 0.8; dot.y = -radius * 0.8;
    c.addChild(dot);
  }
  return c;
}
