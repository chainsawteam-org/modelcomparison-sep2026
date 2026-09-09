import { Container, Graphics, Text } from 'pixi.js';
import { label } from './draw';
import { BUFFER, COLORS, UI, laneX, packetX, tileY } from './config';
import type { GameEvent } from './model';

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number };
type Beam = { x: number; y: number; tx: number; ty: number; life: number; delay: number; color: number };
type Float = { text: Text; life: number; max: number; y: number; delay: number };

export class Effects {
  root = new Container();
  private g = new Graphics();
  private particles: Particle[] = [];
  private beams: Beam[] = [];
  private floats: Float[] = [];
  constructor() { this.root.addChild(this.g); this.root.eventMode = 'none'; }

  launch(event: Extract<GameEvent, { type: 'launch' }>) {
    event.hits.forEach((hit, i) => {
      this.beams.push({ x: packetX(event.packets[i].index), y: BUFFER.cy - 24, tx: laneX(hit.lane), ty: tileY(hit.row), color: COLORS[hit.color].hex, life: 0.52, delay: i * 0.07 });
      this.burst(laneX(hit.lane), tileY(hit.row), COLORS[hit.color].hex, hit.destroyed ? 15 : 6);
    });
    this.float(`+${event.points.toLocaleString()}`, laneX(event.lane), tileY(0) - event.hits.length * 14 - 25, COLORS[event.hits[0].color].hex, 22);
    if (event.chain >= 2) this.float(`${event.chain} PACKET BURST`, laneX(event.lane), 149, UI.mint, 11);
  }

  burst(x: number, y: number, color: number, count = 18) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 140;
      const max = 0.35 + Math.random() * 0.45;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: max, max, color, size: 1.5 + Math.random() * 3 });
    }
  }

  float(value: string, x: number, y: number, color: number = UI.text, size = 18, delay = 0) {
    const t = label(this.root, value, x, y, size, color, { fontWeight: '700', letterSpacing: 1 });
    t.anchor.set(0.5); t.alpha = 0;
    this.floats.push({ text: t, life: 1.35, max: 1.35, y, delay });
  }

  clear() {
    this.particles = []; this.beams = [];
    this.floats.forEach(f => f.text.destroy()); this.floats = []; this.g.clear();
  }

  tick(dt: number, reduced: boolean) {
    this.g.clear();
    this.particles = this.particles.filter(p => {
      p.life -= dt; if (p.life <= 0) return false;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 100 * dt;
      if (!reduced) this.g.roundRect(p.x, p.y, p.size, p.size, 0.6).fill({ color: p.color, alpha: p.life / p.max });
      return true;
    });
    this.beams = this.beams.filter(b => {
      if (b.delay > 0) { b.delay -= dt; return true; }
      b.life -= dt; if (b.life <= 0) return false;
      const a = Math.min(1, b.life * 3);
      const bendY = 522;
      this.g.moveTo(b.x, b.y).lineTo(b.x, bendY + 7).quadraticCurveTo(b.x, bendY, b.x + (b.tx - b.x) * 0.2, bendY)
        .lineTo(b.tx, bendY).lineTo(b.tx, b.ty).stroke({ color: b.color, alpha: a * 0.11, width: reduced ? 4 : 16 });
      this.g.moveTo(b.x, b.y).lineTo(b.x, bendY).lineTo(b.tx, bendY).lineTo(b.tx, b.ty).stroke({ color: b.color, alpha: a, width: 2 });
      this.g.circle(b.tx, b.ty, (1 - b.life / 0.52) * 28).stroke({ color: b.color, alpha: a * 0.7, width: 1.5 });
      return true;
    });
    this.floats = this.floats.filter(f => {
      if (f.delay > 0) { f.delay -= dt; return true; }
      f.life -= dt;
      if (f.life <= 0) { f.text.destroy(); return false; }
      f.text.y = f.y - (f.max - f.life) * (reduced ? 3 : 24);
      f.text.alpha = Math.min(1, f.life * 2.2, (f.max - f.life) * 14);
      return true;
    });
  }
}
