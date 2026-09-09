import { Container, Graphics, Text } from 'pixi.js';
import { UI, VIEW } from '../game/config';
import { clamp, easeOutCubic, mixColor } from '../core/math';
import type { Button } from './button';

export interface StatRow { label: string; value: string; accent?: number }

/**
 * Modal card used by the pause and results screens. Handles its own dim,
 * entrance animation and button layout.
 */
export class Panel extends Container {
  private dim = new Graphics();
  private card = new Graphics();
  private body = new Container();
  private buttons: Button[] = [];
  private t = 0;
  private w: number;
  private h: number;

  constructor(opts: { width?: number; height?: number }) {
    super();
    this.w = opts.width ?? 560;
    this.h = opts.height ?? 460;
    this.dim.rect(-VIEW.w, -VIEW.h, VIEW.w * 3, VIEW.h * 3).fill({ color: 0x03050e, alpha: 0.86 });
    this.dim.eventMode = 'static';
    this.addChild(this.dim, this.card, this.body);
    this.x = VIEW.w / 2;
    this.y = VIEW.h / 2;
    this.draw();
  }

  private draw(): void {
    const g = this.card;
    const w = this.w, h = this.h;
    g.clear();
    g.roundRect(-w / 2, -h / 2, w, h, 22).fill({ color: 0x0b1026, alpha: 1 });
    g.roundRect(-w / 2, -h / 2, w, h, 22).stroke({ width: 2, color: UI.line, alpha: 1 });
    g.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, 3, 2).fill({ color: UI.accent, alpha: 0.55 });
  }

  title(text: string, color = UI.text, size = 40, y = -0.5): Text {
    const t = new Text({
      text, style: {
        fill: color, fontSize: size, fontWeight: '800', letterSpacing: 6,
        fontFamily: 'Segoe UI, system-ui, sans-serif', align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.y = y;
    this.body.addChild(t);
    return t;
  }

  caption(text: string, y: number, color = UI.dim, size = 13, spacing = 3): Text {
    const t = new Text({
      text, style: {
        fill: color, fontSize: size, fontWeight: '700', letterSpacing: spacing,
        fontFamily: 'Segoe UI, system-ui, sans-serif', align: 'center',
      },
    });
    t.anchor.set(0.5);
    t.y = y;
    this.body.addChild(t);
    return t;
  }

  /** Two-column stat table. */
  stats(rows: StatRow[], y: number, width = 400, rowH = 30): void {
    rows.forEach((r, i) => {
      const yy = y + i * rowH;
      const l = new Text({
        text: r.label, style: {
          fill: UI.faint, fontSize: 13, fontWeight: '700', letterSpacing: 2.4,
          fontFamily: 'Segoe UI, system-ui, sans-serif',
        },
      });
      l.anchor.set(0, 0.5);
      l.x = -width / 2; l.y = yy;
      const v = new Text({
        text: r.value, style: {
          fill: r.accent ?? UI.text, fontSize: 16, fontWeight: '800',
          fontFamily: 'Segoe UI, system-ui, sans-serif',
        },
      });
      v.anchor.set(1, 0.5);
      v.x = width / 2; v.y = yy;
      const line = new Graphics();
      line.moveTo(-width / 2, yy + 14).lineTo(width / 2, yy + 14)
        .stroke({ width: 1, color: mixColor(UI.line, 0x000000, 0.35), alpha: 0.7 });
      this.body.addChild(line, l, v);
    });
  }

  add(node: Container): void { this.body.addChild(node); }

  addButton(b: Button, x: number, y: number): void {
    b.x = x; b.y = y;
    this.buttons.push(b);
    this.body.addChild(b);
  }

  update(dt: number): void {
    this.t = clamp(this.t + dt * 2.6, 0, 1);
    const e = easeOutCubic(this.t);
    this.dim.alpha = e;
    this.card.alpha = e;
    this.body.alpha = e;
    const s = 0.92 + e * 0.08;
    this.card.scale.set(s);
    this.body.scale.set(s);
    this.card.y = (1 - e) * 18;
    this.body.y = (1 - e) * 18;
    for (const b of this.buttons) b.update(dt);
  }
}
