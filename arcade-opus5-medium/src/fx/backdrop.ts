import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { COLORS } from '../game/config';
import { glowTexture } from '../core/textures';
import { mixColor } from '../core/math';

function vignetteTexture(): Texture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.30, size / 2, size / 2, size * 0.74);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.6, 'rgba(2,3,10,0.14)');
  g.addColorStop(1, 'rgba(2,3,10,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
}

function gradientTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#0b1030');
  g.addColorStop(0.45, '#070a1d');
  g.addColorStop(1, '#04050f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return Texture.from(c);
}

interface Blob { sprite: Sprite; x: number; y: number; r: number; sp: number; phase: number; hue: number }

/**
 * Ambient background: a vertical gradient, a faint perspective grid and a few
 * slow coloured light pools. Sits behind the letterboxed world and always
 * fills the window, so odd aspect ratios never show bare canvas.
 */
export class Backdrop extends Container {
  private grad = new Sprite(gradientTexture());
  private grid = new Graphics();
  private vignette = new Sprite(vignetteTexture());
  private blobs: Blob[] = [];
  private w = 1280;
  private h = 720;
  private t = 0;
  private heat = 0;

  constructor() {
    super();
    this.eventMode = 'none';
    this.interactiveChildren = false;
    this.addChild(this.grad, this.grid);
    for (let i = 0; i < 5; i++) {
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = COLORS[i % COLORS.length].main;
      s.alpha = 0.06;
      this.addChild(s);
      this.blobs.push({
        sprite: s, hue: i % COLORS.length,
        x: Math.random(), y: Math.random(),
        r: 260 + Math.random() * 320,
        sp: 0.02 + Math.random() * 0.045,
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.addChild(this.vignette);
  }

  /** 0..1 — pushes the backdrop redder as the depot gets crowded. */
  setHeat(v: number): void { this.heat = Math.max(0, Math.min(1, v)); }

  resize(w: number, h: number): void {
    this.w = w; this.h = h;
    this.grad.width = w; this.grad.height = h;

    const g = this.grid;
    g.clear();
    const step = 64;
    for (let x = 0; x <= w; x += step) g.moveTo(x, 0).lineTo(x, h);
    for (let y = 0; y <= h; y += step) g.moveTo(0, y).lineTo(w, y);
    g.stroke({ width: 1, color: 0x1b2450, alpha: 0.28 });

    this.vignette.width = w;
    this.vignette.height = h;
  }

  update(dt: number): void {
    this.t += dt;
    for (const b of this.blobs) {
      b.phase += dt * b.sp * 6;
      const x = (b.x + Math.sin(b.phase) * 0.16) * this.w;
      const y = (b.y + Math.cos(b.phase * 0.7) * 0.13) * this.h;
      b.sprite.x = x; b.sprite.y = y;
      const r = b.r * (1 + Math.sin(b.phase * 0.5) * 0.12);
      b.sprite.width = b.sprite.height = r;
      b.sprite.alpha = 0.045 + Math.sin(b.phase) * 0.015 + this.heat * 0.05;
      b.sprite.tint = mixColor(COLORS[b.hue].main, 0xff3355, this.heat * 0.8);
    }
    this.grid.alpha = 0.75 + Math.sin(this.t * 0.8) * 0.1 + this.heat * 0.6;
    this.grid.tint = mixColor(0xffffff, 0xff5c78, this.heat);
  }
}
