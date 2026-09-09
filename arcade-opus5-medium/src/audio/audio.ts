/**
 * Tiny procedural audio engine. Everything is synthesised with WebAudio --
 * no sample files, no autoplay assumptions: the context is created lazily and
 * resumed on the first real user gesture.
 */

type Wave = OscillatorType;

const SEMI = (n: number) => 440 * Math.pow(2, n / 12);
/** A minor pentatonic ladder, used for the rising delivery ping. */
const LADDER = [-9, -7, -4, -2, 0, 3, 5, 8, 12, 15, 19].map(SEMI);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private beatTimer: number | null = null;
  private beatIndex = 0;
  private intensity = 0;
  private started = false;

  muted = false;

  /** Safe to call repeatedly; only the first gesture actually builds the graph. */
  unlock(): void {
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext || w.webkitAudioContext;
      if (!Ctor) return;
      try { this.ctx = new Ctor(); } catch { return; }
      const master = this.ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.9;
      master.connect(this.ctx.destination);
      const music = this.ctx.createGain();
      music.gain.value = 0;
      music.connect(master);
      const sfx = this.ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(master);
      this.master = master; this.musicBus = music; this.sfxBus = sfx;

      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  // ---------------------------------------------------------------- primitives

  private tone(opts: {
    freq: number; dur: number; type?: Wave; gain?: number; delay?: number;
    slideTo?: number; attack?: number;
  }): void {
    const ctx = this.ctx, bus = this.sfxBus;
    if (!ctx || !bus || this.muted) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t0 + opts.dur);
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    const atk = opts.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g); g.connect(bus);
    osc.start(t0); osc.stop(t0 + opts.dur + 0.05);
  }

  private noise(opts: { dur: number; gain?: number; delay?: number; from?: number; to?: number; q?: number }): void {
    const ctx = this.ctx, bus = this.sfxBus;
    if (!ctx || !bus || !this.noiseBuf || this.muted) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = opts.q ?? 1.1;
    filt.frequency.setValueAtTime(opts.from ?? 900, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(60, opts.to ?? 220), t0 + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.18, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filt); filt.connect(g); g.connect(bus);
    src.start(t0); src.stop(t0 + opts.dur + 0.05);
  }

  // ------------------------------------------------------------------- effects

  pick(): void {
    this.tone({ freq: 620, dur: 0.09, type: 'sine', gain: 0.10, slideTo: 900 });
  }

  hover(): void {
    this.tone({ freq: 1250, dur: 0.05, type: 'sine', gain: 0.03 });
  }

  /** Rising pip; `step` climbs with the combo so streaks sing. */
  deliver(step: number): void {
    const f = LADDER[Math.min(LADDER.length - 1, Math.max(0, step))];
    this.tone({ freq: f, dur: 0.17, type: 'triangle', gain: 0.16 });
    this.tone({ freq: f * 2, dur: 0.10, type: 'sine', gain: 0.06, delay: 0.01 });
  }

  /** Warm chord when an order ships. `chain` brightens the voicing. */
  complete(chain: number): void {
    const base = SEMI(-5 + Math.min(chain, 5) * 2);
    [0, 4, 7, 12].forEach((iv, i) => {
      this.tone({ freq: base * Math.pow(2, iv / 12), dur: 0.5 - i * 0.05, type: 'triangle', gain: 0.13, delay: i * 0.035 });
    });
    this.noise({ dur: 0.3, gain: 0.06, from: 5200, to: 900, q: 0.8 });
  }

  reject(): void {
    this.tone({ freq: 150, dur: 0.16, type: 'square', gain: 0.10, slideTo: 96 });
  }

  vent(slag: boolean): void {
    this.noise({ dur: 0.42, gain: slag ? 0.2 : 0.13, from: 2600, to: 130, q: 0.7 });
    this.tone({ freq: slag ? 190 : 240, dur: 0.28, type: 'sine', gain: 0.12, slideTo: 70 });
  }

  spawn(): void {
    this.tone({ freq: 300, dur: 0.07, type: 'sine', gain: 0.04, slideTo: 420 });
  }

  warn(): void {
    this.tone({ freq: 740, dur: 0.14, type: 'square', gain: 0.09 });
    this.tone({ freq: 560, dur: 0.16, type: 'square', gain: 0.07, delay: 0.14 });
  }

  wave(): void {
    [0, 5, 7, 12, 19].forEach((iv, i) =>
      this.tone({ freq: SEMI(-12 + iv), dur: 0.6, type: 'sawtooth', gain: 0.07, delay: i * 0.07 }));
    this.noise({ dur: 0.8, gain: 0.07, from: 300, to: 6000, q: 0.6 });
  }

  gameOver(): void {
    [0, -3, -7, -12].forEach((iv, i) =>
      this.tone({ freq: SEMI(-2 + iv), dur: 1.1, type: 'triangle', gain: 0.14, delay: i * 0.16 }));
    this.noise({ dur: 1.4, gain: 0.1, from: 1800, to: 60, q: 0.5 });
  }

  ui(): void {
    this.tone({ freq: 480, dur: 0.07, type: 'square', gain: 0.06, slideTo: 720 });
  }

  // -------------------------------------------------------------------- music

  /** A sparse generative pulse whose density tracks how hot the run is. */
  startMusic(): void {
    if (!this.ctx || !this.musicBus || this.started) return;
    this.started = true;
    this.musicBus.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.2);
    const tick = () => {
      this.beat();
      const bpm = 84 + this.intensity * 46;
      this.beatTimer = window.setTimeout(tick, (60 / bpm) * 1000);
    };
    tick();
  }

  stopMusic(): void {
    if (this.beatTimer !== null) { clearTimeout(this.beatTimer); this.beatTimer = null; }
    this.started = false;
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  /** 0..1 -- drives tempo and density of the backing pulse. */
  setIntensity(v: number): void { this.intensity = Math.max(0, Math.min(1, v)); }

  private beat(): void {
    const ctx = this.ctx, bus = this.musicBus;
    if (!ctx || !bus || this.muted) return;
    const t0 = ctx.currentTime;
    const i = this.beatIndex++;
    const roots = [-24, -24, -17, -20];
    const root = roots[Math.floor(i / 8) % roots.length];

    if (i % 2 === 0) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(SEMI(root), t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 0.4);
    }

    const arp = [0, 7, 12, 15, 19, 12];
    if (i % 2 === 1 || this.intensity > 0.45) {
      const iv = arp[i % arp.length];
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(SEMI(root + 24 + iv), t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.035 + this.intensity * 0.03, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 0.3);
    }
  }
}

export const Audio = new AudioEngine();
