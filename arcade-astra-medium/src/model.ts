export type Color = 0 | 1 | 2 | 3;
export type Mode = 'ready' | 'playing' | 'paused' | 'lost' | 'won';
export interface Cell { id: number; color: Color }
export interface Layer { color: Color; need: number; filled: number }
export interface Order { layers: Layer[]; layer: number }
export interface Dock { order: Order; next: Order; busy: number; previous?: Layer }
export type GameEvent =
  | { type: 'arrive'; id: number }
  | { type: 'send'; ids: number[]; color: Color; dock: number; count: number; points: number; perfect: boolean }
  | { type: 'clear' | 'layer'; dock: number; color: Color }
  | { type: 'stage'; stage: number }
  | { type: 'vent'; ids: number[] }
  | { type: 'end'; won: boolean }
  | { type: 'invalid'; dock: number };

export const CAPACITY = 12;
export const TOTAL_ORDERS = 30;
export const STAGES = [
  { name: 'Easy does it', label: 'THE WARM-UP', interval: 2.45, detail: 'One color. One destination.\nFind your rhythm.' },
  { name: 'Picking up', label: 'BUILD YOUR FLOW', interval: 2.05, detail: 'Larger orders are arriving.\nSave cells for full batches.' },
  { name: 'Double duty', label: 'LAYERED CARGO', interval: 1.8, detail: 'Two-color orders unlocked.\nClear the first to reveal the next.' },
  { name: 'Rush hour', label: 'KEEP IT MOVING', interval: 1.55, detail: 'More layered orders.\nLook ahead. Leave room.' },
  { name: 'Last call', label: 'THE FINAL STRETCH', interval: 1.3, detail: 'The terminal is at full speed.\nBring the last orders home.' },
] as const;

/** Pure simulation. Rendering, audio and wall-clock time live outside this class. */
export class Game {
  mode: Mode = 'ready';
  queue: Cell[] = [];
  docks: Dock[] = [];
  selected: Color | null = null;
  score = 0;
  completed = 0;
  elapsed = 0;
  spawnTime = 0;
  fullTime = 0;
  combo = 0;
  comboTime = 0;
  bestCombo = 0;
  perfects = 0;
  dispatched = 0;
  ventCharge = 24;
  vents = 0;
  started = false;
  events: GameEvent[] = [];
  revision = 0;
  incoming: Color = 1;
  private nextId = 0;
  private random: () => number;
  private arrivals = 0;

  constructor(random: () => number = Math.random) {
    this.random = random;
    for (let i = 0; i < 4; i++) {
      const color = i as Color;
      this.docks.push({ order: { layers: [{ color, need: i === 0 ? 3 : 2, filled: 0 }], layer: 0 }, next: this.makeOrder(((i + 1) % 4) as Color), busy: 0 });
    }
    [0, 1, 0, 2, 3, 0].forEach(c => this.addCell(c as Color));
    this.events = [];
  }

  get stage() { return Math.min(4, Math.floor(this.completed / 6)); }
  get interval() { return STAGES[this.stage].interval; }
  get multiplier() { return 1 + Math.min(4, Math.floor(this.combo / 3)); }
  get selectedCount() { return this.queue.filter(c => c.color === this.selected).length; }
  front(index: number) { const order = this.docks[index].order; return order.layers[order.layer]; }

  start() { if (this.mode === 'ready') { this.mode = 'playing'; this.revision++; } }
  pause() {
    if (this.mode === 'playing') this.mode = 'paused';
    else if (this.mode === 'paused') this.mode = 'playing';
    this.revision++;
  }
  select(color: Color) {
    if (this.mode === 'ready') this.start();
    if (this.mode !== 'playing' || !this.queue.some(c => c.color === color)) return;
    this.selected = this.selected === color ? null : color;
    this.revision++;
  }
  dispatch(index: number) {
    if (this.mode !== 'playing' || this.selected === null) return false;
    const dock = this.docks[index];
    if (!dock || dock.busy > 0) return false;
    const front = this.front(index);
    if (front.color !== this.selected) { this.events.push({ type: 'invalid', dock: index }); return false; }
    const cells = this.queue.filter(c => c.color === this.selected).slice(0, front.need - front.filled);
    if (!cells.length) return false;
    this.started = true;
    const perfect = front.filled === 0 && cells.length === front.need;
    const ids = cells.map(c => c.id);
    this.queue = this.queue.filter(c => !ids.includes(c.id));
    front.filled += cells.length;
    dock.previous = { ...front };
    this.dispatched += cells.length;
    this.ventCharge = Math.min(24, this.ventCharge + cells.length);
    this.fullTime = 0;
    let points = cells.length * 20 * this.multiplier;
    if (perfect) { points += cells.length * 30 * this.multiplier; this.perfects++; }
    dock.busy = 0.48;
    const oldStage = this.stage;
    if (front.filled === front.need) {
      if (dock.order.layer < dock.order.layers.length - 1) {
        dock.order.layer++;
        this.events.push({ type: 'layer', dock: index, color: front.color });
      } else {
        this.completed++;
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.comboTime = 11;
        points += 150 * this.multiplier;
        dock.order = dock.next;
        dock.next = this.makeOrder();
        dock.busy = 0.85;
        this.events.push({ type: 'clear', dock: index, color: front.color });
      }
    }
    this.score += points;
    this.events.push({ type: 'send', ids, color: this.selected, dock: index, count: cells.length, points, perfect });
    if (!this.queue.some(c => c.color === this.selected)) this.selected = null;
    if (oldStage !== this.stage) {
      this.spawnTime = 0;
      this.events.push({ type: 'stage', stage: this.stage });
    }
    if (this.completed >= TOTAL_ORDERS) { this.mode = 'won'; this.events.push({ type: 'end', won: true }); }
    this.revision++;
    return true;
  }
  vent() {
    if (this.mode !== 'playing' || this.ventCharge < 24 || this.queue.length === 0) return false;
    // Purge the selected color (up to four), otherwise the four oldest cells.
    const candidates = this.selected === null ? this.queue : this.queue.filter(c => c.color === this.selected);
    const ids = candidates.slice(0, 4).map(c => c.id);
    this.queue = this.queue.filter(c => !ids.includes(c.id));
    this.selected = null;
    this.ventCharge = 0;
    this.vents++;
    this.fullTime = 0;
    this.spawnTime = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.events.push({ type: 'vent', ids });
    this.revision++;
    return true;
  }
  tick(dt: number) {
    if (this.mode !== 'playing') return;
    for (const dock of this.docks) {
      if (dock.busy > 0) { dock.busy = Math.max(0, dock.busy - dt); if (dock.busy === 0) this.revision++; }
    }
    // No time pressure until the player has made their first delivery.
    if (!this.started) return;
    this.elapsed += dt;
    if (this.comboTime > 0) {
      this.comboTime = Math.max(0, this.comboTime - dt);
      if (this.comboTime === 0) { this.combo = 0; this.revision++; }
    }
    this.spawnTime += dt;
    if (this.queue.length === CAPACITY) {
      this.fullTime += dt;
      if (this.fullTime >= 5) { this.mode = 'lost'; this.events.push({ type: 'end', won: false }); this.revision++; }
    } else if (this.spawnTime >= this.interval) {
      this.spawnTime = 0;
      this.addCell(this.incoming);
      this.incoming = this.pickIncoming();
      this.revision++;
    }
  }
  private addCell(color: Color) {
    const cell = { id: this.nextId++, color };
    this.queue.push(cell);
    this.events.push({ type: 'arrive', id: cell.id });
  }
  private pickIncoming(): Color {
    this.arrivals++;
    // Demand-aware supply prevents impossible random-color droughts. Some cells
    // deliberately anticipate the next manifest, rewarding forward planning.
    const demands = this.docks.map((_, i) => this.front(i));
    if (this.arrivals % 4 === 0 && this.stage > 0) {
      const dock = this.docks[Math.floor(this.random() * 4)];
      return dock.next.layers[0].color;
    }
    const weighted: Color[] = [];
    for (const demand of demands) {
      const stored = this.queue.filter(c => c.color === demand.color).length;
      const weight = Math.max(1, demand.need - demand.filled - stored);
      for (let i = 0; i < weight; i++) weighted.push(demand.color);
    }
    return weighted[Math.floor(this.random() * weighted.length)];
  }
  private makeOrder(forced?: Color): Order {
    const color = forced ?? Math.floor(this.random() * 4) as Color;
    const need = this.stage === 0 ? 2 + Math.floor(this.random() * 2) : 3 + Math.floor(this.random() * 2);
    const layers: Layer[] = [{ color, need, filled: 0 }];
    if (this.stage >= 2 && this.random() < (this.stage === 2 ? 0.55 : 0.8)) {
      layers.push({ color: ((color + 1 + Math.floor(this.random() * 3)) % 4) as Color, need: 2 + Math.floor(this.random() * 2), filled: 0 });
    }
    return { layers, layer: 0 };
  }
}
