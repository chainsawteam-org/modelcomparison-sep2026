import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { UI } from './config';
import { VENT } from './layout';
import { glowTexture } from '../core/textures';
import { clamp, damp, mixColor } from '../core/math';

/**
 * The vent: the release valve that lets any orb — including slag, which no bay
 * will take — leave the rail, at the cost of a long cooldown.
 */
export class VentView extends Container {
  private body = new Graphics();
  private ring = new Graphics();
  private glow = new Sprite(glowTexture());
  private chevrons = new Graphics();
  private title: Text;
  private hint: Text;
  private timer: Text;

  private life = 0;
  private hover = 0;
  private hoverTarget = 0;
  private highlight = 0;
  private highlightTarget = 0;
  private punch = 0;
  private ready = 1;

  constructor() {
    super();
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.width = this.glow.height = 240;
    this.glow.x = VENT.x; this.glow.y = VENT.y;
    this.glow.tint = UI.warn;
    this.glow.alpha = 0.1;

    this.body.circle(VENT.x, VENT.y, VENT.r).fill({ color: 0x12162f, alpha: 0.95 });
    this.body.circle(VENT.x, VENT.y, VENT.r).stroke({ width: 2, color: 0x2f3768, alpha: 1 });
    this.body.circle(VENT.x, VENT.y, VENT.r - 12).stroke({ width: 1, color: 0x222a55, alpha: 0.8 });

    this.chevrons = new Graphics();
    for (let i = 0; i < 3; i++) {
      const y = VENT.y - 14 + i * 13;
      this.chevrons.moveTo(VENT.x - 16, y).lineTo(VENT.x, y + 10).lineTo(VENT.x + 16, y);
    }
    this.chevrons.stroke({ width: 3, color: UI.warn, alpha: 0.85 });

    this.title = new Text({
      text: 'VENT', style: {
        fill: UI.dim, fontSize: 12, fontWeight: '800', letterSpacing: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.title.anchor.set(0.5);
    this.title.x = VENT.x; this.title.y = VENT.y + VENT.r + 18;

    this.hint = new Text({
      text: 'SPACE', style: {
        fill: UI.faint, fontSize: 10, fontWeight: '700', letterSpacing: 2.6,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.hint.anchor.set(0.5);
    this.hint.x = VENT.x; this.hint.y = VENT.y + VENT.r + 34;

    this.timer = new Text({
      text: '', style: {
        fill: UI.warn, fontSize: 20, fontWeight: '800',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.timer.anchor.set(0.5);
    this.timer.x = VENT.x; this.timer.y = VENT.y;

    this.addChild(this.glow, this.body, this.ring, this.chevrons, this.title, this.hint, this.timer);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = {
      contains: (x: number, y: number) =>
        (x - VENT.x) ** 2 + (y - VENT.y) ** 2 <= (VENT.r + 6) ** 2,
    };
  }

  setHover(v: boolean): void { this.hoverTarget = v ? 1 : 0; }
  setHighlight(v: boolean): void { this.highlightTarget = v ? 1 : 0; }
  fire(): void { this.punch = 1; }

  update(dt: number, cooldown: number, max: number): void {
    this.life += dt;
    this.hover = damp(this.hover, this.hoverTarget, 16, dt);
    this.highlight = damp(this.highlight, this.highlightTarget, 14, dt);
    this.punch = Math.max(0, this.punch - dt * 3);
    const t = clamp(1 - cooldown / Math.max(0.01, max), 0, 1);
    this.ready = t;

    const beat = 0.5 + Math.sin(this.life * 6) * 0.5;
    const col = t >= 1 ? UI.warn : 0x4a5385;

    this.chevrons.alpha = (t >= 1 ? 0.85 : 0.25) + this.punch * 0.4;
    this.chevrons.y = t >= 1 ? Math.sin(this.life * 3) * 2 : 0;
    this.chevrons.tint = col;

    this.timer.text = t >= 1 ? '' : cooldown.toFixed(1);
    this.timer.alpha = t >= 1 ? 0 : 0.8;
    this.chevrons.visible = t >= 1;

    this.glow.tint = t >= 1 ? mixColor(UI.warn, 0xffffff, this.punch * 0.6) : 0x2b3468;
    this.glow.alpha = 0.07 + (t >= 1 ? this.highlight * (0.18 + beat * 0.12) + this.hover * 0.1 : 0) + this.punch * 0.5;
    this.glow.width = this.glow.height = 240 * (1 + this.punch * 0.3);

    this.title.style.fill = t >= 1 ? mixColor(UI.dim, UI.warn, this.highlight) : UI.faint;

    // cooldown sweep
    const r = this.ring;
    r.clear();
    if (t < 1) {
      r.arc(VENT.x, VENT.y, VENT.r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t)
        .stroke({ width: 5, color: UI.warn, alpha: 0.55 });
    } else {
      r.circle(VENT.x, VENT.y, VENT.r - 6)
        .stroke({ width: 3, color: UI.warn, alpha: 0.25 + this.highlight * (0.4 + beat * 0.3) });
    }

    const s = 1 + this.punch * 0.09 + this.hover * 0.03 + this.highlight * 0.02;
    this.body.scale.set(s);
    this.body.x = VENT.x - VENT.x * s;
    this.body.y = VENT.y - VENT.y * s;
  }

  get isReady(): boolean { return this.ready >= 1; }
}
