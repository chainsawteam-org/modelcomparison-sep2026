import { Container, Graphics, Text } from 'pixi.js';
import { UI, VIEW } from '../game/config';
import { clamp, easeOutCubic, mixColor } from '../core/math';

/** Centre-screen announcement used for wave changes and warnings. */
export class Banner extends Container {
  private plate = new Graphics();
  private title: Text;
  private sub: Text;
  private t = 1;
  private dur = 2.4;
  private color = UI.accent;

  constructor(y: number) {
    super();
    this.y = y;
    this.title = new Text({
      text: '', style: {
        fill: UI.text, fontSize: 36, fontWeight: '800', letterSpacing: 8,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.title.anchor.set(0.5);
    this.sub = new Text({
      text: '', style: {
        fill: UI.dim, fontSize: 15, fontWeight: '700', letterSpacing: 3,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.sub.anchor.set(0.5);
    this.sub.y = 30;
    this.addChild(this.plate, this.title, this.sub);
    this.visible = false;
    this.eventMode = 'none';
  }

  show(title: string, sub: string, color = UI.accent, dur = 2.4): void {
    this.title.text = title;
    this.sub.text = sub;
    this.color = color;
    this.title.style.fill = mixColor(UI.text, color, 0.55);
    this.sub.style.fill = mixColor(UI.dim, color, 0.35);
    this.t = 0;
    this.dur = dur;
    this.visible = true;
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.t += dt / this.dur;
    if (this.t >= 1) { this.visible = false; return; }

    // slide in, hold, slide out
    const inT = clamp(this.t / 0.18, 0, 1);
    const outT = clamp((this.t - 0.78) / 0.22, 0, 1);
    const e = easeOutCubic(inT);
    this.alpha = e * (1 - outT);
    this.x = VIEW.w / 2 + (1 - e) * -90 + outT * 90;
    const s = 0.9 + e * 0.1;
    this.title.scale.set(s);

    const w = Math.max(this.title.width, this.sub.width) + 120;
    const g = this.plate;
    g.clear();
    g.roundRect(-w / 2, -34, w, 84, 16).fill({ color: 0x090d20, alpha: 0.82 });
    g.moveTo(-w / 2 + 14, -34).lineTo(w / 2 - 14, -34).stroke({ width: 2, color: this.color, alpha: 0.9 });
    g.moveTo(-w / 2 + 14, 50).lineTo(w / 2 - 14, 50).stroke({ width: 2, color: this.color, alpha: 0.45 });
  }
}
