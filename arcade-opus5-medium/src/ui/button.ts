import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { UI } from '../game/config';
import { glowTexture } from '../core/textures';
import { damp, mixColor } from '../core/math';
import { Audio } from '../audio/audio';

export interface ButtonOpts {
  label: string;
  width?: number;
  height?: number;
  color?: number;
  /** Filled buttons carry the primary action; ghost ones are secondary. */
  ghost?: boolean;
  fontSize?: number;
}

export class Button extends Container {
  private bg = new Graphics();
  private glow = new Sprite(glowTexture());
  private text: Text;
  private hover = 0;
  private hoverTarget = 0;
  private press = 0;
  private life = 0;
  readonly w: number;
  readonly h: number;
  private color: number;
  private ghost: boolean;
  private inner = new Container();

  onClick: (() => void) | null = null;

  constructor(opts: ButtonOpts) {
    super();
    this.w = opts.width ?? 220;
    this.h = opts.height ?? 56;
    this.color = opts.color ?? UI.accent;
    this.ghost = opts.ghost ?? false;

    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.tint = this.color;
    this.glow.width = this.w * 2.1;
    this.glow.height = this.h * 3.4;
    this.glow.alpha = 0;

    this.text = new Text({
      text: opts.label,
      style: {
        fill: this.ghost ? UI.dim : 0x05070f,
        fontSize: opts.fontSize ?? 17,
        fontWeight: '800',
        letterSpacing: 3,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.text.anchor.set(0.5);

    this.inner.addChild(this.glow, this.bg, this.text);
    this.addChild(this.inner);
    this.draw();

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = {
      contains: (x: number, y: number) =>
        Math.abs(x) <= this.w / 2 && Math.abs(y) <= this.h / 2,
    };
    this.on('pointerover', () => { this.hoverTarget = 1; Audio.hover(); });
    this.on('pointerout', () => { this.hoverTarget = 0; this.press = 0; });
    this.on('pointerdown', () => { this.press = 1; });
    this.on('pointerup', () => {
      if (this.press > 0) { Audio.ui(); this.onClick?.(); }
      this.press = 0;
    });
    this.on('pointerupoutside', () => { this.press = 0; });
  }

  private draw(): void {
    const g = this.bg;
    g.clear();
    const r = this.h / 2;
    if (this.ghost) {
      g.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, r).fill({ color: 0x0e1330, alpha: 0.6 });
      g.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, r).stroke({ width: 2, color: mixColor(UI.line, this.color, 0.4), alpha: 0.9 });
    } else {
      g.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, r).fill({ color: this.color, alpha: 1 });
      g.roundRect(-this.w / 2 + 3, -this.h / 2 + 3, this.w - 6, this.h * 0.42, r)
        .fill({ color: mixColor(this.color, 0xffffff, 0.35), alpha: 0.45 });
    }
  }

  update(dt: number): void {
    this.life += dt;
    this.hover = damp(this.hover, this.hoverTarget, 18, dt);
    const p = this.press > 0 ? 1 : 0;
    const s = 1 + this.hover * 0.035 - p * 0.045;
    this.inner.scale.set(s);
    this.glow.alpha = this.hover * (this.ghost ? 0.16 : 0.3) + (this.ghost ? 0 : 0.08);
    this.text.style.fill = this.ghost
      ? mixColor(UI.dim, 0xffffff, this.hover)
      : 0x05070f;
    this.bg.alpha = 1;
  }
}
