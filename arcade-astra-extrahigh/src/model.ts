import { CAPACITY, LANES, SECTORS } from './config';

export type Mode = 'ready' | 'playing' | 'paused' | 'sectorEnd' | 'won' | 'lost';
export type Tile = { id: number; color: number; hp: number; shield: boolean };
export type Packet = { id: number; color: number };
export type Hit = { tileId: number; lane: number; row: number; color: number; destroyed: boolean };
export type GameEvent =
  | { type: 'arrival'; packet: Packet }
  | { type: 'launch'; hits: Hit[]; packets: { id: number; index: number }[]; points: number; chain: number; lane: number }
  | { type: 'reroute'; lane: number }
  | { type: 'end'; won: boolean }
  | { type: 'sector' }
  | { type: 'warning' };

export class GameModel {
  mode: Mode = 'ready';
  sector = 0;
  lanes: Tile[][] = [];
  queue: Packet[] = [];
  upcoming: number[] = [];
  selectedId: number | null = null;
  routing = false;
  score = 0;
  combo = 1;
  comboTime = 0;
  bestChain = 0;
  totalCleared = 0;
  totalLaunched = 0;
  elapsed = 0;
  sectorCleared = 0;
  sectorTotal = 0;
  arrivalTime = 0;
  overflowTime = 0;
  energy = 16;
  passiveEnergy = 0;
  events: GameEvent[] = [];
  private id = 0;
  private arrivals = 0;

  constructor(private random: () => number = Math.random) { this.setupSector(); }

  get interval() { return SECTORS[this.sector].interval; }
  get selected() {
    const at = this.queue.findIndex(p => p.id === this.selectedId);
    if (at < 0) return [];
    const color = this.queue[at].color;
    let a = at, b = at;
    while (a > 0 && this.queue[a - 1].color === color) a--;
    while (b < this.queue.length - 1 && this.queue[b + 1].color === color) b++;
    return this.queue.slice(a, b + 1);
  }

  start() { if (this.mode === 'ready') this.mode = 'playing'; }

  restart() {
    this.mode = 'playing'; this.sector = 0; this.score = 0; this.combo = 1;
    this.comboTime = 0; this.bestChain = 0; this.totalCleared = 0;
    this.totalLaunched = 0; this.elapsed = 0; this.energy = 16;
    this.passiveEnergy = 0; this.events = []; this.arrivals = 0;
    this.setupSector();
  }

  setupSector() {
    const spec = SECTORS[this.sector];
    this.lanes = Array.from({ length: LANES }, (_, lane) => {
      const result: Tile[] = [];
      let color = lane % spec.colors;
      for (let row = 0; row < spec.rows; row++) {
        // Deliberate short runs, with all initial colors reachable across the six lanes.
        const openingPair = this.sector === 0 && lane === 0 && row === 1;
        if (row > 0 && !openingPair && (row % 2 === 0 || this.random() < 0.35))
          color = (color + 1 + Math.floor(this.random() * (spec.colors - 1))) % spec.colors;
        const shield = row > 0 && this.random() < spec.armor;
        result.push({ id: ++this.id, color, hp: shield ? 2 : 1, shield });
      }
      return result;
    });
    this.queue = [];
    const starter = [0, 0, 1, 2, 1];
    for (const color of starter) this.queue.push({ id: ++this.id, color });
    this.upcoming = [];
    for (let i = 0; i < 3; i++) this.upcoming.push(this.nextColor());
    this.sectorTotal = this.lanes.flat().length;
    this.sectorCleared = 0; this.selectedId = null; this.routing = false;
    this.arrivalTime = 0; this.overflowTime = 0;
    this.energy = Math.max(8, this.energy);
  }

  nextSector() {
    if (this.mode !== 'sectorEnd') return;
    this.sector++; this.setupSector(); this.mode = 'playing';
  }

  private nextColor() {
    const demand = Array(SECTORS[this.sector].colors).fill(0) as number[];
    for (const tile of this.lanes.flat()) demand[tile.color] += tile.hp;
    for (const packet of this.queue) demand[packet.color]--;
    for (const color of this.upcoming) demand[color]--;
    let choices = demand.map((n, i) => ({ color: i, weight: Math.max(0, n) })).filter(v => v.weight > 0);
    // Extra stock near the end can be rerouted or held, but never introduce an absent color.
    if (!choices.length) choices = [...new Set(this.lanes.flat().map(t => t.color))].map(color => ({ color, weight: 1 }));
    if (!choices.length) return 0;
    const exposed = new Set(this.lanes.filter(l => l.length).map(l => l[0].color));
    if (this.arrivals % 3 === 0 && choices.some(c => exposed.has(c.color))) choices = choices.filter(c => exposed.has(c.color));
    let roll = this.random() * choices.reduce((sum, c) => sum + c.weight, 0);
    for (const choice of choices) { roll -= choice.weight; if (roll <= 0) return choice.color; }
    return choices[choices.length - 1].color;
  }

  select(index: number) {
    if (this.mode !== 'playing' || !this.queue[index]) return;
    this.routing = false;
    this.selectedId = this.queue[index].id;
  }

  preview(lane: number) {
    const group = this.selected;
    if (!group.length || !this.lanes[lane]) return { hits: 0, clears: 0 };
    let ammo = group.length, hits = 0, clears = 0;
    for (const tile of this.lanes[lane]) {
      if (tile.color !== group[0].color || ammo <= 0) break;
      const damage = Math.min(ammo, tile.hp);
      hits += damage; ammo -= damage;
      if (damage === tile.hp) clears++;
    }
    return { hits, clears };
  }

  launch(lane: number) {
    if (this.mode !== 'playing') return false;
    if (this.routing) return this.reroute(lane);
    const group = this.selected;
    const prediction = this.preview(lane);
    if (!prediction.hits) return false;
    const hits: Hit[] = [];
    const used = group.slice(0, prediction.hits);
    const packets = used.map(p => ({ id: p.id, index: this.queue.indexOf(p) }));
    let row = 0;
    for (let i = 0; i < used.length; i++) {
      const tile = this.lanes[lane][0];
      tile.hp--;
      const destroyed = tile.hp === 0;
      hits.push({ tileId: tile.id, lane, row, color: tile.color, destroyed });
      if (destroyed) { this.lanes[lane].shift(); row++; }
    }
    this.queue = this.queue.filter(p => !used.some(u => u.id === p.id));
    const remaining = group.filter(p => !used.includes(p));
    this.selectedId = remaining[0]?.id ?? null;
    this.overflowTime = 0;
    this.totalLaunched += used.length;
    this.totalCleared += prediction.clears;
    this.sectorCleared += prediction.clears;
    if (prediction.hits >= 2) { this.combo = Math.min(5, this.combo + 1); this.comboTime = 12; }
    this.bestChain = Math.max(this.bestChain, prediction.hits);
    const points = Math.round((prediction.hits * 100 + Math.max(0, prediction.hits - 1) * 75) * this.combo);
    this.score += points;
    this.energy = Math.min(16, this.energy + prediction.hits + Math.max(0, prediction.hits - 1));
    this.events.push({ type: 'launch', hits, packets, points, chain: prediction.hits, lane });
    // Reconcile forecast colors when their last target disappears.
    const remainingColors = new Set(this.lanes.flat().map(t => t.color));
    this.upcoming = this.upcoming.map(c => remainingColors.has(c) ? c : this.nextColor());
    if (this.lanes.every(l => !l.length)) {
      this.score += 500 * (this.sector + 1) + this.queue.length * 75;
      this.routing = false; this.selectedId = null;
      if (this.sector === SECTORS.length - 1) {
        this.mode = 'won'; this.events.push({ type: 'end', won: true });
      } else { this.mode = 'sectorEnd'; this.events.push({ type: 'sector' }); }
    }
    return true;
  }

  toggleReroute() {
    if (this.mode !== 'playing' || this.energy < 8) return false;
    this.routing = !this.routing; this.selectedId = null; return true;
  }

  reroute(lane: number) {
    if (this.mode !== 'playing' || this.energy < 8 || this.lanes[lane]?.length < 2) return false;
    // Rotate past the entire exposed run so rerouting always changes the exposed color.
    const stack = this.lanes[lane];
    if (!stack || stack.every(t => t.color === stack[0].color)) return false;
    const color = stack[0].color;
    do { stack.push(stack.shift()!); } while (stack[0].color === color);
    this.energy -= 8; this.routing = false;
    this.events.push({ type: 'reroute', lane }); return true;
  }

  callNext() {
    if (this.mode !== 'playing' || this.queue.length >= CAPACITY) return false;
    const color = this.upcoming.shift() ?? this.nextColor();
    const packet = { id: ++this.id, color };
    this.queue.push(packet); this.arrivals++;
    this.upcoming.push(this.nextColor()); this.arrivalTime = 0;
    this.events.push({ type: 'arrival', packet });
    return true;
  }

  tick(dt: number) {
    if (this.mode !== 'playing') return;
    this.elapsed += dt;
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.combo = 1;
    this.passiveEnergy += dt;
    if (this.passiveEnergy >= 4) {
      this.energy = Math.min(16, this.energy + Math.floor(this.passiveEnergy / 4));
      this.passiveEnergy %= 4;
    }
    if (this.queue.length >= CAPACITY) {
      const before = this.overflowTime;
      this.overflowTime += dt;
      if (Math.floor(before) < Math.floor(this.overflowTime)) this.events.push({ type: 'warning' });
      if (this.overflowTime >= 5) {
        this.mode = 'lost'; this.events.push({ type: 'end', won: false });
      }
      return;
    }
    this.overflowTime = 0;
    this.arrivalTime += dt;
    if (this.arrivalTime >= this.interval) {
      const remainingTime = this.arrivalTime % this.interval;
      this.callNext(); this.arrivalTime = remainingTime;
    }
  }
}
