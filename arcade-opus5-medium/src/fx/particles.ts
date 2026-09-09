import { Container, Sprite, Text, type TextStyleFontWeight } from 'pixi.js';
import { discTexture, glowTexture, ringTexture, streakTexture } from '../core/textures';
import { easeOutCubic, mixColor } from '../core/math';

type Kind = 'disc' | 'glow' | 'streak' | 'ring';

interface P {
  sprite: Sprite;
  vx: number; vy: number;
  life: number; max: number;
  drag: number; gravity: number;
  from: number; to: number;
  size0: number; size1: number;
  spin: number;
  alpha0: number;
}

interface Float {
  node: Text;
  vy: number;
  life: number;
  max: number;
  scale: number;
}

/**
 * A single pooled particle layer plus floating score text. Everything is
 * additively blended so bursts read as light rather than paint.
 */
export class FxLayer extends Container {
  private pool: Sprite[] = [];
  private live: P[] = [];
  private floats: Float[] = [];
  private textLayer = new Container();

  constructor() {
    super();
    this.addChild(this.textLayer);
    this.eventMode = 'none';
    this.interactiveChildren = false;
  }

  private texFor(kind: Kind) {
    switch (kind) {
      case 'glow': return glowTexture();
      case 'streak': return streakTexture();
      case 'ring': return ringTexture();
      default: return discTexture();
    }
  }

  private take(kind: Kind): Sprite {
    const s = this.pool.pop() ?? new Sprite();
    s.texture = this.texFor(kind);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.visible = true;
    s.rotation = 0;
    this.addChildAt(s, 0);
    return s;
  }

  private push(kind: Kind, o: {
    x: number; y: number; vx: number; vy: number; life: number;
    from: number; to?: number; size0: number; size1: number;
    drag?: number; gravity?: number; alpha?: number; spin?: number; rotation?: number;
  }): void {
    const sprite = this.take(kind);
    sprite.x = o.x; sprite.y = o.y;
    sprite.rotation = o.rotation ?? 0;
    sprite.tint = o.from;
    sprite.alpha = o.alpha ?? 1;
    this.live.push({
      sprite, vx: o.vx, vy: o.vy, life: 0, max: o.life,
      drag: o.drag ?? 2.2, gravity: o.gravity ?? 0,
      from: o.from, to: o.to ?? o.from,
      size0: o.size0, size1: o.size1, spin: o.spin ?? 0,
      alpha0: o.alpha ?? 1,
    });
  }

  /** Radial spray of sparks — the workhorse impact effect. */
  burst(x: number, y: number, color: number, count = 14, power = 1): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (90 + Math.random() * 260) * power;
      this.push('disc', {
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.45,
        from: mixColor(color, 0xffffff, 0.35), to: color,
        size0: (5 + Math.random() * 7) * power, size1: 0,
        drag: 2.6, gravity: 260,
      });
    }
    this.push('glow', {
      x, y, vx: 0, vy: 0, life: 0.32,
      from: color, size0: 40 * power, size1: 150 * power, alpha: 0.75,
    });
  }

  /** Expanding ring, used for order completions and wave changes. */
  shock(x: number, y: number, color: number, size = 200, life = 0.5): void {
    this.push('ring', {
      x, y, vx: 0, vy: 0, life,
      from: color, size0: 20, size1: size, alpha: 0.85,
    });
  }

  /** Soft light pulse without debris. */
  pulse(x: number, y: number, color: number, size = 120, life = 0.3): void {
    this.push('glow', { x, y, vx: 0, vy: 0, life, from: color, size0: size * 0.4, size1: size, alpha: 0.7 });
  }

  /** Directional plume, used by the vent. */
  jet(x: number, y: number, angle: number, color: number, count = 18): void {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9;
      const sp = 120 + Math.random() * 340;
      this.push('streak', {
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3,
        from: mixColor(color, 0xffffff, 0.4), to: color,
        size0: 26 + Math.random() * 22, size1: 4,
        drag: 3.2, rotation: a,
      });
    }
  }

  /** A few embers left behind by a moving orb. */
  trail(x: number, y: number, color: number): void {
    this.push('disc', {
      x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
      life: 0.28, from: color, size0: 9, size1: 0, drag: 3, alpha: 0.7,
    });
  }

  /** Rising score / callout text. */
  float(x: number, y: number, label: string, color: number, size = 22, weight: TextStyleFontWeight = '800'): void {
    const node = new Text({
      text: label,
      style: {
        fill: color, fontSize: size, fontWeight: weight,
        fontFamily: 'Segoe UI, Inter, system-ui, sans-serif',
        letterSpacing: 0.5,
        dropShadow: { color: 0x000814, alpha: 0.75, blur: 5, distance: 0, angle: 0 },
      },
    });
    node.anchor.set(0.5);
    node.x = x; node.y = y;
    this.textLayer.addChild(node);
    this.floats.push({ node, vy: -58, life: 0, max: 0.95, scale: 1 });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        this.removeChild(p.sprite);
        p.sprite.visible = false;
        this.pool.push(p.sprite);
        this.live.splice(i, 1);
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.rotation += p.spin * dt;
      const e = easeOutCubic(t);
      const size = p.size0 + (p.size1 - p.size0) * e;
      const base = p.sprite.texture.width || 1;
      p.sprite.scale.set(size / base);
      p.sprite.tint = mixColor(p.from, p.to, t);
      p.sprite.alpha = p.alpha0 * (1 - t * t);
    }

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life += dt;
      const t = f.life / f.max;
      if (t >= 1) {
        f.node.destroy();
        this.floats.splice(i, 1);
        continue;
      }
      f.node.y += f.vy * dt;
      f.vy *= Math.exp(-2.6 * dt);
      const pop = t < 0.16 ? 0.6 + 0.4 * (t / 0.16) + 0.25 * Math.sin((t / 0.16) * Math.PI) : 1;
      f.node.scale.set(pop * f.scale);
      f.node.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    }
  }

  clear(): void {
    for (const p of this.live) { this.removeChild(p.sprite); p.sprite.destroy(); }
    this.live.length = 0;
    for (const s of this.pool) s.destroy();
    this.pool.length = 0;
    for (const f of this.floats) f.node.destroy();
    this.floats.length = 0;
  }
}
