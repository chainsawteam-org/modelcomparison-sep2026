import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import type { Color } from './model.ts';

export const C = { bg: 0x0b101d, panel: 0x111a29, line: 0x263247, text: 0xf0f1ec, muted: 0x8392aa, faint: 0x70819b, mint: 0xaff3ce };
export const COLORS = [0x6ce5c0, 0xff8f83, 0xb9a1fa, 0xf5ce78];
export const NAMES = ['MINT', 'CORAL', 'IRIS', 'GOLD'];
export function box(parent: Container, x: number, y: number, w: number, h: number, fill = C.panel, radius = 14, stroke = C.line, alpha = 1) {
  const g = new Graphics().roundRect(x, y, w, h, radius).fill({ color: fill, alpha });
  if (stroke) g.stroke({ color: stroke, width: 1 });
  parent.addChild(g); return g;
}
export function text(parent: Container, value: string, x: number, y: number, size = 14, color = C.text, extra: Partial<TextStyleOptions> = {}) {
  const t = new Text({ text: value, style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: size, fill: color, fontWeight: '500', ...extra }, resolution: 2 });
  t.position.set(x, y); parent.addChild(t); return t;
}
export function mono(parent: Container, value: string, x: number, y: number, size = 11, color = C.muted) {
  return text(parent, value, x, y, size, color, { fontFamily: 'Consolas, monospace', letterSpacing: 1.2 });
}
export function line(parent: Container, x: number, y: number, x2: number, y2: number, color = C.line, alpha = 1, width = 1) {
  const g = new Graphics().moveTo(x, y).lineTo(x2, y2).stroke({ color, alpha, width }); parent.addChild(g); return g;
}
export function symbol(parent: Container, color: Color, x: number, y: number, size: number, tint = COLORS[color]) {
  const g = new Graphics();
  if (color === 0) g.poly([0, -size, size, 0, 0, size, -size, 0]).fill(tint);
  else if (color === 1) { g.circle(0, 0, size * 0.86).fill(tint); g.circle(-size * 0.2, -size * 0.2, size * 0.25).fill({ color: 0xffffff, alpha: 0.22 }); }
  else if (color === 2) g.poly([0, -size, size, size * 0.8, -size, size * 0.8]).fill(tint);
  else { g.roundRect(-size * 0.35, -size, size * 0.7, size * 2, size * 0.15).fill(tint); g.roundRect(-size, -size * 0.35, size * 2, size * 0.7, size * 0.15).fill(tint); }
  g.position.set(x, y); parent.addChild(g); return g;
}
export function button(parent: Container, label: string, x: number, y: number, w: number, h: number, action: () => void, primary = false, enabled = true) {
  const container = new Container(); container.position.set(x, y); parent.addChild(container);
  const bg = box(container, 0, 0, w, h, primary ? C.mint : 0x192436, 10, primary ? C.mint : 0x344258);
  const labelText = text(container, label, w / 2, h / 2, 13, primary ? 0x10291f : C.text, { fontWeight: '700' });
  labelText.anchor.set(0.5);
  if (enabled) {
    container.eventMode = 'static'; container.cursor = 'pointer';
    container.on('pointertap', action);
    container.on('pointerover', () => { bg.tint = primary ? 0xffffff : 0xc8efd9; container.scale.set(1.015); });
    container.on('pointerout', () => { bg.tint = 0xffffff; container.scale.set(1); });
  } else container.alpha = 0.4;
  return container;
}

interface Particle { object: Graphics; vx: number; vy: number; life: number; max: number }
interface Flight { object: Container; fromX: number; fromY: number; toX: number; toY: number; time: number; delay: number }
interface Float { object: Container; time: number; max: number; vy: number }
export class Effects {
  root = new Container();
  private particles: Particle[] = [];
  private flights: Flight[] = [];
  private floats: Float[] = [];
  burst(x: number, y: number, color: number, amount = 18) {
    for (let i = 0; i < amount; i++) {
      const g = new Graphics().roundRect(-2, -2, 4 + Math.random() * 3, 4, 1).fill(color);
      g.position.set(x, y); this.root.addChild(g);
      const angle = Math.random() * Math.PI * 2, speed = 35 + Math.random() * 145;
      const life = 0.4 + Math.random() * 0.45;
      this.particles.push({ object: g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 35, life, max: life });
    }
  }
  fly(x: number, y: number, tx: number, ty: number, color: Color, delay: number) {
    const object = new Container();
    const halo = new Graphics().circle(0, 0, 20).fill({ color: COLORS[color], alpha: 0.12 }); object.addChild(halo);
    symbol(object, color, 0, 0, 10);
    this.root.addChild(object); object.position.set(x, y);
    this.flights.push({ object, fromX: x, fromY: y, toX: tx, toY: ty, time: 0, delay });
  }
  label(value: string, x: number, y: number, color = C.mint, size = 20) {
    const object = new Container(); object.position.set(x, y);
    const t = text(object, value, 0, 0, size, color, { fontWeight: '800', dropShadow: { color: C.bg, blur: 8, distance: 0, alpha: 1 } }); t.anchor.set(0.5);
    this.root.addChild(object); this.floats.push({ object, time: 0, max: 1.2, vy: -30 });
  }
  update(dt: number) {
    this.particles = this.particles.filter(p => {
      p.life -= dt; p.object.x += p.vx * dt; p.object.y += p.vy * dt; p.vy += 140 * dt; p.object.rotation += dt * 3; p.object.alpha = Math.max(0, p.life / p.max);
      if (p.life <= 0) { p.object.destroy(); return false; } return true;
    });
    this.flights = this.flights.filter(f => {
      f.time += dt; const p = Math.max(0, Math.min(1, (f.time - f.delay) / 0.38));
      const e = p * p * (3 - 2 * p);
      f.object.x = f.fromX + (f.toX - f.fromX) * e;
      f.object.y = f.fromY + (f.toY - f.fromY) * e - Math.sin(p * Math.PI) * 45;
      f.object.scale.set(1 + Math.sin(p * Math.PI) * 0.35);
      if (p >= 1) { f.object.destroy({ children: true }); return false; } return true;
    });
    this.floats = this.floats.filter(f => {
      f.time += dt; f.object.y += f.vy * dt; f.object.alpha = Math.min(1, (f.max - f.time) * 3);
      if (f.time >= f.max) { f.object.destroy({ children: true }); return false; } return true;
    });
  }
  reset() {
    this.root.removeChildren().forEach(c => c.destroy({ children: true }));
    this.particles = []; this.flights = []; this.floats = [];
  }
}
