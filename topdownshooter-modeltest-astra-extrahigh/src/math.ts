export interface Point { x: number; z: number }
export interface Obstacle extends Point { r: number }
export const LIMIT_X = 20;
export const LIMIT_Z = 15;
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export function normalize(x: number, z: number): Point {
  const d = Math.hypot(x, z);
  return d > 0.0001 ? { x: x / d, z: z / d } : { x: 0, z: 0 };
}
/** Earliest intersection along a swept projectile, including a start inside. */
export function segmentCircle(a: Point, b: Point, c: Point, r: number): number | null {
  const dx = b.x - a.x, dz = b.z - a.z, ox = a.x - c.x, oz = a.z - c.z;
  const aa = dx * dx + dz * dz, cc = ox * ox + oz * oz - r * r;
  if (cc <= 0) return 0;
  if (aa < 1e-10) return null;
  const bb = 2 * (ox * dx + oz * dz), disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
export function moveCircle(p: Point, dx: number, dz: number, r: number, obstacles: Obstacle[]): void {
  // Substeps keep fast dashes and charges from tunnelling through cover.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
  for (let s = 0; s < steps; s++) {
    p.x = clamp(p.x + dx / steps, -LIMIT_X + r, LIMIT_X - r);
    p.z = clamp(p.z + dz / steps, -LIMIT_Z + r, LIMIT_Z - r);
    for (const o of obstacles) {
      const vx = p.x - o.x, vz = p.z - o.z, d = Math.hypot(vx, vz), min = r + o.r;
      if (d < min) {
        const n = d > 0.00001 ? { x: vx / d, z: vz / d } : { x: 1, z: 0 };
        p.x = o.x + n.x * min; p.z = o.z + n.z * min;
      }
    }
  }
}
export function clearLine(a: Point, b: Point, obstacles: Obstacle[], margin = 0): boolean {
  return !obstacles.some(o => segmentCircle(a, b, o, o.r + margin) !== null);
}
/** Small shared flow field. All pursuers route around cover without per-enemy A*. */
export class Navigation {
  private size = 1;
  private w = 41;
  private h = 31;
  private field = new Float32Array(this.w * this.h);
  private blocked = new Uint8Array(this.w * this.h);
  constructor(obstacles: Obstacle[]) {
    for (let z = 0; z < this.h; z++) for (let x = 0; x < this.w; x++) {
      this.blocked[z * this.w + x] = +obstacles.some(o => dist2({ x: x - 20, z: z - 15 }, o) < (o.r + 0.85) ** 2);
    }
  }
  update(target: Point): void {
    this.field.fill(10000);
    const tx = clamp(Math.round(target.x / this.size + 20), 0, this.w - 1);
    const tz = clamp(Math.round(target.z / this.size + 15), 0, this.h - 1);
    const root = tz * this.w + tx, queue = [root];
    this.field[root] = 0;
    for (let i = 0; i < queue.length; i++) {
      const idx = queue[i], x = idx % this.w, z = Math.floor(idx / this.w);
      for (const [ox, oz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + ox, nz = z + oz, ni = nz * this.w + nx;
        if (nx < 0 || nx >= this.w || nz < 0 || nz >= this.h || this.blocked[ni]) continue;
        if (this.field[ni] > this.field[idx] + 1) { this.field[ni] = this.field[idx] + 1; queue.push(ni); }
      }
    }
  }
  direction(p: Point, target: Point, obstacles: Obstacle[], r: number): Point {
    if (clearLine(p, target, obstacles, r + 0.1)) return normalize(target.x - p.x, target.z - p.z);
    const x = clamp(Math.round(p.x + 20), 0, this.w - 1), z = clamp(Math.round(p.z + 15), 0, this.h - 1);
    let best = 10001, result = target;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const nx = x + ox, nz = z + oz;
      if (nx < 0 || nx >= this.w || nz < 0 || nz >= this.h || (ox === 0 && oz === 0)) continue;
      const candidate = { x: nx - 20, z: nz - 15 };
      const score = this.field[nz * this.w + nx] + Math.hypot(ox, oz) * 0.1;
      if (score < best && clearLine(p, candidate, obstacles, r + 0.05)) { best = score; result = candidate; }
    }
    return normalize(result.x - p.x, result.z - p.z);
  }
}
