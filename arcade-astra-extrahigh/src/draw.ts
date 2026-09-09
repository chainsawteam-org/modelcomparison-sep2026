import { Container, Graphics, Rectangle, Text, type TextStyleOptions } from 'pixi.js';
import { COLORS, UI } from './config';

export function label(parent: Container, value: string, x: number, y: number, size = 14, color: number = UI.text, extra: Partial<TextStyleOptions> = {}) {
  const result = new Text({ text: value, style: { fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: size, fill: color, ...extra }, resolution: 2 });
  result.position.set(x, y); parent.addChild(result); return result;
}

export function micro(parent: Container, value: string, x: number, y: number, color: number = UI.muted, size = 10) {
  return label(parent, value, x, y, size, color, { letterSpacing: 1.8, fontWeight: '600' });
}

export function panel(parent: Container, x: number, y: number, w: number, h: number, fill: number = UI.panel, radius = 14) {
  const g = new Graphics().roundRect(x, y + 6, w, h, radius).fill({ color: 0x030711, alpha: 0.35 })
    .roundRect(x, y, w, h, radius).fill(fill).stroke({ color: UI.line, alpha: 0.7, width: 1 });
  parent.addChild(g); return g;
}

export function symbol(g: Graphics, color: number, x: number, y: number, r: number, ink: number, alpha = 1) {
  if (color === 0) g.poly([x, y - r, x + r * 0.8, y, x, y + r, x - r * 0.8, y]).fill({ color: ink, alpha });
  if (color === 1) g.circle(x, y, r * 0.74).stroke({ color: ink, alpha, width: Math.max(2, r * 0.27) });
  if (color === 2) g.poly([x, y - r, x + r * 0.9, y + r * 0.7, x - r * 0.9, y + r * 0.7]).fill({ color: ink, alpha });
  if (color === 3) g.roundRect(x - r * 0.68, y - r * 0.68, r * 1.36, r * 1.36, 2).stroke({ color: ink, alpha, width: Math.max(2, r * 0.26) });
  if (color === 4) {
    g.roundRect(x - r, y - r * 0.25, r * 2, r * 0.5, 1).fill({ color: ink, alpha });
    g.roundRect(x - r * 0.25, y - r, r * 0.5, r * 2, 1).fill({ color: ink, alpha });
  }
}

export function chip(color: number, size = 48, bright = true) {
  const palette = COLORS[color];
  const g = new Graphics();
  g.roundRect(-size / 2, -size / 2 + 4, size, size, 10).fill({ color: 0x000000, alpha: 0.3 });
  g.roundRect(-size / 2, -size / 2, size, size, 10).fill(palette.dark).stroke({ color: palette.hex, width: 1.3, alpha: bright ? 0.65 : 0.35 });
  g.roundRect(-size / 2 + 3, -size / 2 + 3, size - 6, size / 2 - 3, 7).fill({ color: palette.hex, alpha: 0.08 });
  g.roundRect(-size / 2 + 11, -size / 2, size - 22, 2, 1).fill({ color: palette.hex, alpha: 0.8 });
  symbol(g, color, 0, 0, size * 0.2, palette.hex);
  return g;
}

export function button(parent: Container, title: string, x: number, y: number, w: number, h: number, action: () => void, primary = false) {
  const c = new Container(); c.position.set(x, y);
  const g = new Graphics(); c.addChild(g);
  const t = label(c, title, w / 2, h / 2, 13, primary ? UI.bg : UI.text, { fontWeight: '600', letterSpacing: 0.5 });
  t.anchor.set(0.5);
  const draw = (hover: boolean) => {
    g.clear().roundRect(0, 3, w, h, 9).fill({ color: 0x000000, alpha: 0.24 });
    g.roundRect(0, 0, w, h, 9).fill(primary ? (hover ? 0xb1ffe1 : UI.mint) : (hover ? 0x20334a : 0x162438))
      .stroke({ color: primary ? UI.mint : (hover ? UI.muted : UI.line), width: 1 });
  };
  draw(false); c.eventMode = 'static'; c.cursor = 'pointer'; c.hitArea = new Rectangle(0, 0, w, h);
  c.on('pointerover', () => draw(true)); c.on('pointerout', () => draw(false));
  c.on('pointerdown', () => { c.scale.set(0.985); });
  c.on('pointerupoutside', () => { c.scale.set(1); });
  c.on('pointerup', () => { c.scale.set(1); action(); });
  parent.addChild(c); return c;
}

export function line(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: number = UI.line, alpha = 1, width = 1) {
  g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, alpha, width });
}
