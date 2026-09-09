import type { Container } from 'pixi.js';

/**
 * Decaying positional + rotational camera shake with a hard cap so a busy
 * moment never turns the screen to soup.
 */
export class Shake {
  private amount = 0;
  private t = 0;
  private baseX = 0;
  private baseY = 0;

  constructor(private target: Container, private max = 22) {}

  setOrigin(x: number, y: number): void { this.baseX = x; this.baseY = y; }

  add(power: number): void {
    this.amount = Math.min(this.max, this.amount + power);
  }

  update(dt: number): void {
    this.t += dt;
    this.amount *= Math.exp(-7.5 * dt);
    if (this.amount < 0.05) {
      this.amount = 0;
      this.target.x = this.baseX;
      this.target.y = this.baseY;
      this.target.rotation = 0;
      return;
    }
    const a = this.amount;
    this.target.x = this.baseX + Math.sin(this.t * 61.3) * a;
    this.target.y = this.baseY + Math.sin(this.t * 47.7 + 1.7) * a * 0.8;
    this.target.rotation = Math.sin(this.t * 39.1) * a * 0.0009;
  }
}
