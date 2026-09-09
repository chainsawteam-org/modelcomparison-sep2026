import {
  BAY_COUNT, CHAIN_WINDOW, COLORS, flowWindow, OVERFLOW_GRACE,
  QUEUE_CAPACITY, SCORE, ventCooldown, waveSpec, type WaveSpec,
} from './config';
import { Rng, clamp, lerp } from '../core/math';
import type { Bay, GameEvent, Orb, RunStats } from './types';

const PREVIEW = 3;
const SHIP_TIME = 0.42;
const JAM_TIME = 3.4;

/**
 * All gameplay rules live here. The model owns no Pixi objects: it mutates
 * plain state and returns a list of events that the scene turns into visuals
 * and sound. That keeps balance changes cheap and the presentation layer dumb.
 */
export class GameModel {
  readonly queue: Orb[] = [];
  /** Orbs visible in the intake preview, oldest first. */
  readonly upcoming: Orb[] = [];
  readonly bays: Bay[] = [];

  score = 0;
  multiplier = 1;
  chain = 0;
  chainTimer = 0;
  waveIndex = 1;
  waveTime = 0;
  spawnTimer = 0;
  incinerator = 0;
  /** Seconds left before the multiplier slips for lack of shipments. */
  flow = 0;
  /** Seconds the rail has been full; the depot floods at OVERFLOW_GRACE. */
  overflow = 0;
  /** The arrival that cannot fit yet, parked at the intake. */
  held: Orb | null = null;
  over = false;
  elapsed = 0;
  /** Combo step, used to pitch the delivery ping. */
  step = 0;

  private rng: Rng;
  private nextId = 1;
  private nextOrderId = 1;
  private danger = false;

  stats: RunStats = {
    score: 0, wave: 1, delivered: 0, orders: 0,
    bestChain: 0, bestMultiplier: 1, vented: 0, time: 0,
  };

  constructor(seed?: number) {
    this.rng = new Rng(seed);
    const spec = this.spec;
    this.spawnTimer = 1.1;
    for (let i = 0; i < BAY_COUNT; i++) {
      this.bays.push({
        id: i, orderId: this.nextOrderId++, color: 0, required: 2, filled: 0,
        priority: false, timeLeft: 0, timeMax: 0, state: 'active', stateTimer: 0,
      });
      this.issueOrder(this.bays[i], spec, false);
    }
    for (let i = 0; i < PREVIEW; i++) this.upcoming.push(this.makeOrb(spec));
    // Seed the rail with hues the opening orders actually want, so the first
    // few seconds always teach the match rather than testing luck.
    const opening = [...new Set(this.bays.map((b) => b.color))].slice(0, 3);
    for (const color of opening) {
      this.queue.push({ id: this.nextId++, kind: 'normal', color, units: 1 });
    }
  }

  get spec(): WaveSpec { return waveSpec(this.waveIndex); }
  /** How long a fresh vent charge takes right now. */
  get ventMax(): number { return ventCooldown(this.multiplier); }
  /** 0..1 of the flow window remaining; 0 when no multiplier is at stake. */
  get flowLeft(): number { return this.multiplier > 1 ? this.flow / flowWindow(this.multiplier) : 0; }
  get full(): boolean { return this.queue.length >= QUEUE_CAPACITY; }
  /** 0..1 fill of the rail, used for the pressure gauge and audio intensity. */
  get pressure(): number { return this.queue.length / QUEUE_CAPACITY; }
  get waveProgress(): number { return clamp(this.waveTime / this.spec.duration, 0, 1); }

  indexOf(id: number): number { return this.queue.findIndex((o) => o.id === id); }

  // ----------------------------------------------------------------- generation

  private makeOrb(spec: WaveSpec): Orb {
    const id = this.nextId++;
    const r = this.rng.next();
    if (r < spec.slag) return { id, kind: 'slag', color: -1, units: 1 };
    if (r < spec.slag + spec.prism) return { id, kind: 'prism', color: -1, units: 1 };
    const color = this.pickArrivalColor(spec);
    if (r < spec.slag + spec.prism + spec.twin) return { id, kind: 'twin', color, units: 2 };
    return { id, kind: 'normal', color, units: 1 };
  }

  /**
   * Arrivals lean towards hues the bays are currently asking for. Pure random
   * feeds produce unwinnable stretches; a bias keeps failure the player's fault.
   */
  private pickArrivalColor(spec: WaveSpec): number {
    const pool = spec.colors;
    if (this.rng.chance(0.5)) {
      const wanted = this.bays
        .filter((b) => b.state === 'active' && b.color < pool && b.filled < b.required)
        .map((b) => b.color);
      if (wanted.length) return this.rng.pick(wanted);
    }
    return this.rng.int(0, pool - 1);
  }

  private issueOrder(bay: Bay, spec: WaveSpec, allowPriority = true): void {
    const counts = new Array(COLORS.length).fill(0);
    for (const b of this.bays) if (b !== bay && b.state !== 'jammed') counts[b.color]++;

    const options: number[] = [];
    for (let c = 0; c < spec.colors; c++) if (counts[c] < 2) options.push(c);
    const color = options.length ? this.rng.pick(options) : this.rng.int(0, spec.colors - 1);

    const priority = allowPriority && spec.priority > 0 && this.rng.chance(spec.priority);
    bay.orderId = this.nextOrderId++;
    bay.color = color;
    bay.required = this.rng.int(spec.orderMin, spec.orderMax);
    bay.filled = 0;
    bay.priority = priority;
    bay.timeMax = priority ? spec.priorityTime + bay.required * 1.4 : 0;
    bay.timeLeft = bay.timeMax;
    bay.state = 'active';
    bay.stateTimer = 0;
  }

  // --------------------------------------------------------------------- update

  update(dt: number): GameEvent[] {
    const ev: GameEvent[] = [];
    if (this.over) return ev;

    this.elapsed += dt;
    this.stats.time = this.elapsed;
    this.incinerator = Math.max(0, this.incinerator - dt);

    // ---- flow: the multiplier slips if the depot stops shipping
    if (this.multiplier > 1) {
      this.flow -= dt;
      if (this.flow <= 0) {
        this.multiplier--;
        this.flow = flowWindow(this.multiplier);
        ev.push({ type: 'multiplierDecay', value: this.multiplier });
      }
    }

    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) { this.chain = 0; this.step = 0; }
    }

    // ---- wave clock
    this.waveTime += dt;
    const spec = this.spec;
    if (this.waveTime >= spec.duration) {
      this.waveTime -= spec.duration;
      this.waveIndex++;
      this.stats.wave = this.waveIndex;
      ev.push({ type: 'wave', index: this.waveIndex });
    }

    // ---- bay clocks
    for (const bay of this.bays) {
      if (bay.state === 'shipping') {
        bay.stateTimer -= dt;
        if (bay.stateTimer <= 0) { this.issueOrder(bay, this.spec); ev.push({ type: 'order', bay: bay.id }); }
      } else if (bay.state === 'jammed') {
        bay.stateTimer -= dt;
        if (bay.stateTimer <= 0) { this.issueOrder(bay, this.spec, false); ev.push({ type: 'order', bay: bay.id }); }
      } else if (bay.priority) {
        bay.timeLeft -= dt;
        if (bay.timeLeft <= 0) {
          bay.timeLeft = 0;
          bay.state = 'jammed';
          bay.stateTimer = JAM_TIME;
          ev.push({ type: 'expire', bay: bay.id });
          this.breakMultiplier(ev);
        }
      }
    }

    // ---- intake
    const cur = this.spec;
    const interval = lerp(cur.spawnFrom, cur.spawnTo, this.waveProgress);
    if (this.held) {
      // Nothing new arrives while an orb is stuck at the door.
      if (!this.full) {
        this.queue.push(this.held);
        ev.push({ type: 'spawn', orb: this.held });
        this.held = null;
        this.overflow = 0;
      } else {
        this.overflow += dt;
        if (this.overflow >= OVERFLOW_GRACE) {
          this.over = true;
          ev.push({ type: 'gameOver' });
        }
      }
    } else {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer += interval;
        const orb = this.upcoming.shift() ?? this.makeOrb(cur);
        this.upcoming.push(this.makeOrb(cur));
        if (this.full) {
          this.held = orb;
          this.overflow = 0;
          this.breakMultiplier(ev);
        } else {
          this.queue.push(orb);
          ev.push({ type: 'spawn', orb });
        }
      }
    }

    // ---- danger signalling
    const danger = this.queue.length >= QUEUE_CAPACITY - 1 || this.held !== null;
    if (danger !== this.danger) { this.danger = danger; ev.push({ type: 'danger', on: danger }); }

    this.stats.score = this.score;
    return ev;
  }

  private breakMultiplier(ev: GameEvent[]): void {
    if (this.multiplier > 1) {
      this.multiplier = 1;
      this.chain = 0;
      this.step = 0;
      this.chainTimer = 0;
      this.flow = flowWindow(1);
      ev.push({ type: 'multiplierLost' });
    }
  }

  // --------------------------------------------------------------------- actions

  canAccept(orb: Orb, bay: Bay): boolean {
    if (bay.state !== 'active' || this.over) return false;
    if (orb.kind === 'slag') return false;
    return orb.kind === 'prism' || orb.color === bay.color;
  }

  /** Send a queued orb to a bay. Returns the events it produced (empty if illegal). */
  deploy(orbId: number, bayId: number): GameEvent[] {
    const ev: GameEvent[] = [];
    if (this.over) return ev;
    const idx = this.indexOf(orbId);
    const bay = this.bays[bayId];
    if (idx < 0 || !bay) return ev;
    const orb = this.queue[idx];

    if (!this.canAccept(orb, bay)) {
      ev.push({ type: 'reject', orb, bay: bayId });
      return ev;
    }

    this.queue.splice(idx, 1);
    const units = Math.min(orb.units, bay.required - bay.filled);
    bay.filled += units;
    this.step = Math.min(10, this.step + 1);
    const points = Math.round(SCORE.deliver * units * this.multiplier);
    this.score += points;
    this.stats.delivered++;
    ev.push({ type: 'deliver', orb, bay: bayId, units, points, step: this.step });

    if (bay.filled >= bay.required) {
      this.chain = this.chainTimer > 0 ? this.chain + 1 : 1;
      this.chainTimer = CHAIN_WINDOW;
      const factor = bay.priority ? SCORE.priorityFactor : 1;
      const bonus = SCORE.chainStep * Math.max(0, this.chain - 1);
      const gained = Math.round((SCORE.completeUnit * bay.required * factor + bonus) * this.multiplier);
      this.score += gained;
      this.stats.orders++;
      this.stats.bestChain = Math.max(this.stats.bestChain, this.chain);
      this.multiplier = Math.min(SCORE.multiplierCap, this.multiplier + 1);
      this.flow = flowWindow(this.multiplier);
      this.stats.bestMultiplier = Math.max(this.stats.bestMultiplier, this.multiplier);
      bay.state = 'shipping';
      bay.stateTimer = SHIP_TIME;
      ev.push({ type: 'complete', bay: bayId, points: gained, chain: this.chain, priority: bay.priority, required: bay.required });
    }
    return ev;
  }

  /** Burn an orb in the vent. Slag is free; anything else costs half the multiplier. */
  ventOrb(orbId: number): GameEvent[] {
    const ev: GameEvent[] = [];
    if (this.over) return ev;
    const idx = this.indexOf(orbId);
    if (idx < 0) return ev;
    const orb = this.queue[idx];
    if (this.incinerator > 0) { ev.push({ type: 'ventBlocked', orb }); return ev; }

    this.queue.splice(idx, 1);
    this.incinerator = this.ventMax;
    this.stats.vented++;
    let points = 0;
    if (orb.kind === 'slag') {
      points = Math.round(SCORE.ventSlag * this.multiplier);
      this.score += points;
    } else if (this.multiplier > 1) {
      this.multiplier = Math.max(1, Math.floor(this.multiplier / 2));
    }
    ev.push({ type: 'vent', orb, points, slag: orb.kind === 'slag' });
    return ev;
  }

  /** Best legal bay for an orb, preferring the one closest to shipping. */
  suggestBay(orb: Orb): number {
    let best = -1, bestScore = -Infinity;
    for (const bay of this.bays) {
      if (!this.canAccept(orb, bay)) continue;
      const remaining = bay.required - bay.filled;
      let s = 10 - remaining;
      if (bay.priority) s += 6;
      if (orb.units >= remaining) s += 4;
      if (orb.kind === 'prism' && bay.color >= 0) s -= 2;
      if (s > bestScore) { bestScore = s; best = bay.id; }
    }
    return best;
  }
}
