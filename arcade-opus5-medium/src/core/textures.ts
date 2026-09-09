import { Texture } from 'pixi.js';

/**
 * Every visual in the game is generated at runtime — no art files are shipped.
 * These helpers bake a handful of white/greyscale canvases once at boot which
 * are then tinted per-colour by the sprites that use them.
 */

const cache = new Map<string, Texture>();

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = Texture.from(canvas);
  cache.set(key, tex);
  return tex;
}

/** Soft radial falloff, used for glows, bloom and light pools. */
export function glowTexture(): Texture {
  return make('glow', 256, (ctx, s) => {
    const r = s / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** A shaded sphere: lit from the upper-left, with a rim light along the bottom. */
export function orbTexture(): Texture {
  return make('orb', 256, (ctx, s) => {
    const r = s / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 6, 0, Math.PI * 2);
    ctx.clip();

    const body = ctx.createRadialGradient(r * 0.72, r * 0.66, r * 0.1, r, r, r);
    body.addColorStop(0, 'rgba(255,255,255,1)');
    body.addColorStop(0.45, 'rgba(215,215,215,1)');
    body.addColorStop(0.85, 'rgba(120,120,120,1)');
    body.addColorStop(1, 'rgba(78,78,78,1)');
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, s, s);

    // bounced rim light from below-right
    const rim = ctx.createRadialGradient(r * 1.25, r * 1.4, r * 0.1, r, r, r);
    rim.addColorStop(0, 'rgba(255,255,255,0.42)');
    rim.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, s, s);

    // specular highlight
    ctx.globalAlpha = 0.75;
    const spec = ctx.createRadialGradient(r * 0.68, r * 0.56, 0, r * 0.68, r * 0.56, r * 0.42);
    spec.addColorStop(0, 'rgba(255,255,255,1)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
  });
}

/** Crisp anti-aliased disc for particles and pips. */
export function discTexture(): Texture {
  return make('disc', 64, (ctx, s) => {
    const r = s / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Thin ring, used for shockwaves. */
export function ringTexture(): Texture {
  return make('ring', 256, (ctx, s) => {
    const r = s / 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(r, r, r - 12, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** Short streak for velocity trails. */
export function streakTexture(): Texture {
  return make('streak', 128, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, s * 0.42, s, s * 0.16);
  });
}

export function warmTextures(): void {
  glowTexture(); orbTexture(); discTexture(); ringTexture(); streakTexture();
}
