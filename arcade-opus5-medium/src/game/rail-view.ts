import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { QUEUE_CAPACITY, UI } from './config';
import { GAUGE, PORT, RAIL_X0, RAIL_Y, slotX } from './layout';
import { glowTexture } from '../core/textures';
import { clamp, damp, mixColor } from '../core/math';

/**
 * The intake rail: eight sockets, the port orbs arrive through, and the
 * pressure gauge that tells the player how close the depot is to flooding.
 */
export class RailView extends Container {
  private sockets: Graphics[] = [];
  private socketGlow: Sprite[] = [];
  private base = new Graphics();
  private gauge = new Graphics();
  private portG = new Graphics();
  private portGlow = new Sprite(glowTexture());
  private gaugeLabel: Text;

  private life = 0;
  private danger = 0;
  private dangerTarget = 0;
  private pressure = 0;
  private flash: number[] = new Array(QUEUE_CAPACITY).fill(0);

  constructor() {
    super();

    // rail plate
    this.base.roundRect(RAIL_X0 - 22, RAIL_Y - 62, GAUGE.w + 44, 124, 22)
      .fill({ color: 0x0c1024, alpha: 0.85 })
      .stroke({ width: 2, color: UI.line, alpha: 0.6 });
    this.addChild(this.base);

    for (let i = 0; i < QUEUE_CAPACITY; i++) {
      const glow = new Sprite(glowTexture());
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.width = glow.height = 150;
      glow.x = slotX(i); glow.y = RAIL_Y;
      glow.alpha = 0;
      this.socketGlow.push(glow);

      const g = new Graphics();
      const hazard = i >= QUEUE_CAPACITY - 2;
      g.circle(slotX(i), RAIL_Y, 34).fill({ color: 0x141936, alpha: 0.9 });
      g.circle(slotX(i), RAIL_Y, 34).stroke({
        width: 2, color: hazard ? 0x4a2f4f : 0x232a52, alpha: 0.95,
      });
      this.sockets.push(g);
      this.addChild(g, glow);
    }

    // arrival port
    this.portGlow.anchor.set(0.5);
    this.portGlow.blendMode = 'add';
    this.portGlow.tint = UI.accent;
    this.portGlow.width = this.portGlow.height = 160;
    this.portGlow.x = PORT.x; this.portGlow.y = PORT.y;
    this.portGlow.alpha = 0.12;
    this.portG.roundRect(PORT.x - 16, PORT.y - 44, 32, 88, 14)
      .fill({ color: 0x161c3c, alpha: 0.95 })
      .stroke({ width: 2, color: UI.line, alpha: 0.9 });
    for (let i = 0; i < 3; i++) {
      this.portG.moveTo(PORT.x - 8, PORT.y - 18 + i * 18).lineTo(PORT.x + 8, PORT.y - 18 + i * 18);
    }
    this.portG.stroke({ width: 2, color: UI.faint, alpha: 0.5 });
    this.addChild(this.portGlow, this.portG);

    this.gaugeLabel = new Text({
      text: 'DEPOT PRESSURE', style: {
        fill: UI.faint, fontSize: 10, fontWeight: '700', letterSpacing: 3,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.gaugeLabel.x = GAUGE.x; this.gaugeLabel.y = GAUGE.y - 16;
    this.addChild(this.gauge, this.gaugeLabel);
  }

  /** Called when an orb lands in (or leaves) a socket. */
  ping(index: number): void {
    if (index >= 0 && index < this.flash.length) this.flash[index] = 1;
  }

  setDanger(on: boolean): void { this.dangerTarget = on ? 1 : 0; }
  setPressure(v: number): void { this.pressure = v; }

  update(dt: number, filled: number, overflow: number): void {
    this.life += dt;
    this.danger = damp(this.danger, this.dangerTarget, 10, dt);
    const beat = 0.5 + Math.sin(this.life * 7) * 0.5;

    for (let i = 0; i < QUEUE_CAPACITY; i++) {
      this.flash[i] = Math.max(0, this.flash[i] - dt * 2.6);
      const occupied = i < filled;
      const hazard = i >= QUEUE_CAPACITY - 2;
      const g = this.socketGlow[i];
      let a = this.flash[i] * 0.5;
      if (occupied && hazard) a += 0.1 + beat * 0.14 * this.danger;
      g.tint = hazard && occupied ? UI.bad : UI.accent;
      g.alpha = a;
      this.sockets[i].alpha = occupied ? 1 : 0.55;
    }

    this.portGlow.alpha = 0.1 + Math.sin(this.life * 2.4) * 0.04 + (overflow > 0 ? beat * 0.4 : 0);
    this.portGlow.tint = overflow > 0 ? UI.bad : UI.accent;

    // pressure gauge
    const g = this.gauge;
    g.clear();
    g.roundRect(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h, 6).fill({ color: 0x141936, alpha: 0.95 });
    const p = clamp(this.pressure, 0, 1);
    const col = p < 0.5 ? mixColor(UI.good, UI.accent, 0.4) : p < 0.8 ? UI.warn : UI.bad;
    if (p > 0.001) {
      g.roundRect(GAUGE.x + 2, GAUGE.y + 2, Math.max(4, (GAUGE.w - 4) * p), GAUGE.h - 4, 4)
        .fill({ color: col, alpha: p > 0.8 ? 0.75 + beat * 0.25 : 1 });
    }
    // tick marks
    for (let i = 1; i < QUEUE_CAPACITY; i++) {
      const x = GAUGE.x + (GAUGE.w / QUEUE_CAPACITY) * i;
      g.moveTo(x, GAUGE.y + 2).lineTo(x, GAUGE.y + GAUGE.h - 2);
    }
    g.stroke({ width: 1, color: 0x0a0e21, alpha: 0.8 });
    g.roundRect(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h, 6)
      .stroke({ width: 1.5, color: mixColor(UI.line, col, this.danger), alpha: 0.9 });

    this.gaugeLabel.style.fill = p > 0.8 ? UI.bad : UI.faint;
  }
}
