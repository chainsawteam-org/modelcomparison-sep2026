import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { UI, VIEW } from './config';
import { glowTexture } from '../core/textures';
import { clamp, damp, mixColor } from '../core/math';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function label(text: string, size = 11): Text {
  return new Text({
    text, style: {
      fill: UI.faint, fontSize: size, fontWeight: '700', letterSpacing: 3.4,
      fontFamily: 'Segoe UI, system-ui, sans-serif',
    },
  });
}

/** The top status bar: wave, score, multiplier and chain. */
export class Hud extends Container {
  private scoreText: Text;
  private bestText: Text;
  private waveNum: Text;
  private waveName: Text;
  private waveBar = new Graphics();
  private multText: Text;
  private multGlow = new Sprite(glowTexture());
  private chainText: Text;
  private bar = new Graphics();

  private shown = 0;
  private target = 0;
  private punch = 0;
  private multPunch = 0;
  private multValue = 1;
  private waveT = 0;
  private chainAlpha = 0;
  private flow = 0;
  private life = 0;
  private flowBar = new Graphics();

  constructor(private best: number) {
    super();

    this.bar.roundRect(-4, -10, VIEW.w + 8, 86, 12).fill({ color: 0x0a0e21, alpha: 0.82 });
    this.bar.moveTo(24, 76).lineTo(VIEW.w - 24, 76).stroke({ width: 1, color: UI.line, alpha: 0.75 });
    this.addChild(this.bar);

    // ---- wave block
    const wl = label('WAVE');
    wl.x = 40; wl.y = 14;
    this.waveNum = new Text({
      text: '1', style: {
        fill: UI.text, fontSize: 30, fontWeight: '800',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.waveNum.x = 40; this.waveNum.y = 28;
    this.waveName = new Text({
      text: 'INTAKE', style: {
        fill: UI.accent, fontSize: 13, fontWeight: '800', letterSpacing: 2.4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.waveName.x = 82; this.waveName.y = 38;
    this.addChild(wl, this.waveNum, this.waveName, this.waveBar);

    // ---- score block
    const sl = label('SCORE');
    sl.anchor.set(0.5, 0);
    sl.x = VIEW.w / 2; sl.y = 10;
    this.scoreText = new Text({
      text: '0', style: {
        fill: UI.text, fontSize: 38, fontWeight: '800', letterSpacing: 1,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.x = VIEW.w / 2; this.scoreText.y = 24;
    this.bestText = new Text({
      text: '', style: {
        fill: UI.faint, fontSize: 11, fontWeight: '700', letterSpacing: 2,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.bestText.anchor.set(0, 0.5);
    this.bestText.x = VIEW.w / 2 + 96; this.bestText.y = 44;
    this.addChild(sl, this.scoreText, this.bestText);

    // ---- multiplier block
    this.multGlow.anchor.set(0.5);
    this.multGlow.blendMode = 'add';
    this.multGlow.width = this.multGlow.height = 190;
    this.multGlow.x = VIEW.w - 86; this.multGlow.y = 38;
    this.multGlow.alpha = 0;

    const ml = label('MULTIPLIER');
    ml.anchor.set(1, 0);
    ml.x = VIEW.w - 40; ml.y = 14;
    this.multText = new Text({
      text: 'x1', style: {
        fill: UI.text, fontSize: 32, fontWeight: '800',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.multText.anchor.set(1, 0);
    this.multText.x = VIEW.w - 40; this.multText.y = 28;

    this.chainText = new Text({
      text: '', style: {
        fill: UI.accent, fontSize: 14, fontWeight: '800', letterSpacing: 2,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.chainText.anchor.set(1, 0);
    this.chainText.x = VIEW.w - 106; this.chainText.y = 40;

    this.addChild(this.multGlow, ml, this.multText, this.chainText, this.flowBar);
    this.setBest(best);
  }

  setBest(v: number): void {
    this.best = v;
    this.bestText.text = v > 0 ? `BEST ${fmt(v)}` : '';
  }

  setScore(v: number): void {
    if (v > this.target) this.punch = 1;
    this.target = v;
  }

  setMultiplier(v: number): void {
    if (v !== this.multValue) this.multPunch = 1;
    this.multValue = v;
  }

  setWave(index: number, name: string, progress: number): void {
    if (this.waveNum.text !== String(index)) {
      this.waveNum.text = String(index);
      this.waveName.text = name;
      this.waveName.x = 46 + this.waveNum.width;
    }
    this.waveT = progress;
  }

  /** 0..1 of the flow window left before the multiplier slips. */
  setFlow(v: number): void { this.flow = v; }

  setChain(chain: number): void {
    if (chain >= 2) {
      this.chainText.text = `CHAIN x${chain}`;
      this.chainAlpha = 1;
    } else {
      this.chainAlpha = 0;
    }
  }

  update(dt: number): void {
    this.life += dt;
    this.shown = damp(this.shown, this.target, 12, dt);
    if (Math.abs(this.target - this.shown) < 0.6) this.shown = this.target;
    this.scoreText.text = fmt(this.shown);

    this.punch = Math.max(0, this.punch - dt * 3.2);
    this.scoreText.scale.set(1 + this.punch * 0.09);
    if (this.best > 0 && this.target > this.best) this.bestText.text = 'NEW BEST';

    this.multPunch = Math.max(0, this.multPunch - dt * 2.6);
    this.multText.text = `x${this.multValue}`;
    const hot = clamp((this.multValue - 1) / 11, 0, 1);
    const col = mixColor(UI.text, UI.warn, hot);
    this.multText.style.fill = this.multValue > 1 ? mixColor(col, UI.bad, Math.max(0, hot - 0.55) * 2) : UI.dim;
    this.multText.scale.set(1 + this.multPunch * 0.16);
    this.multGlow.tint = mixColor(UI.accent, UI.warn, hot);
    this.multGlow.alpha = hot * 0.14 + this.multPunch * 0.3;

    this.chainText.alpha = damp(this.chainText.alpha, this.chainAlpha, 12, dt);
    this.chainText.scale.set(1 + Math.sin(this.life * 9) * 0.04 * this.chainText.alpha);

    // flow meter: how long the multiplier survives without a shipment
    this.flowBar.clear();
    if (this.flow > 0) {
      const w = 96, x = VIEW.w - 40 - w, y = 64;
      this.flowBar.roundRect(x, y, w, 4, 2).fill({ color: 0x1e2447, alpha: 1 });
      this.flowBar.roundRect(x, y, Math.max(2, w * clamp(this.flow, 0, 1)), 4, 2)
        .fill({ color: this.flow < 0.3 ? UI.bad : mixColor(UI.warn, UI.accent, this.flow), alpha: 1 });
    }

    this.waveBar.clear();
    const x = 40, y = 64, w = 190;
    this.waveBar.roundRect(x, y, w, 4, 2).fill({ color: 0x1e2447, alpha: 1 });
    this.waveBar.roundRect(x, y, Math.max(2, w * clamp(this.waveT, 0, 1)), 4, 2)
      .fill({ color: mixColor(UI.accent, UI.warn, this.waveT), alpha: 1 });
  }
}
