export class AudioSystem {
  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private beatClock = 0;
  private beat = 0;
  enabled = true;
  music = true;
  volume = 0.5;
  unlock(): void {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.master.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      void this.ctx.resume().catch(() => {});
    } catch { /* Audio is an enhancement; unsupported devices still play. */ }
  }
  setVolume(v: number): void { this.volume = v; this.sync(); }
  sync(): void { if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.03); }
  private tone(f: number, end: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const t = this.ctx.currentTime + delay, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + 0.004); gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t + duration + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  private hiss(duration: number, volume: number, frequency: number): void {
    if (!this.ctx || !this.master || !this.noise || !this.enabled) return;
    const t = this.ctx.currentTime, source = this.ctx.createBufferSource(), gain = this.ctx.createGain(), filter = this.ctx.createBiquadFilter();
    source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(t); source.stop(t + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  shoot(scatter: boolean): void { this.tone(scatter ? 130 : 240, 45, scatter ? 0.16 : 0.08, scatter ? 0.24 : 0.12, 'triangle'); this.hiss(scatter ? 0.16 : 0.055, scatter ? 0.23 : 0.09, 2500); }
  hit(): void { this.tone(740, 240, 0.045, 0.07, 'triangle'); }
  kill(big = false): void { this.tone(big ? 85 : 170, 30, big ? 0.32 : 0.16, 0.19, 'triangle'); this.hiss(big ? 0.3 : 0.12, 0.17, 1200); }
  hurt(): void { this.tone(150, 40, 0.25, 0.32, 'sawtooth'); this.hiss(0.2, 0.25, 500); }
  dash(): void { this.hiss(0.2, 0.16, 1800); this.tone(300, 900, 0.15, 0.08, 'sine'); }
  pickup(): void { this.tone(880, 1400, 0.09, 0.06); }
  reload(done = false): void { this.tone(done ? 600 : 220, done ? 950 : 160, 0.09, 0.14, 'square'); }
  pulse(): void { this.tone(90, 28, 0.7, 0.5, 'sine'); this.tone(1200, 80, 0.35, 0.17, 'triangle'); this.hiss(0.35, 0.2, 2200); }
  ui(): void { this.tone(600, 1000, 0.1, 0.13, 'sine'); }
  wave(): void { for (let i = 0; i < 3; i++) this.tone(330 * [1,1.25,1.5][i], 330 * [1,1.25,1.5][i], 0.3, 0.12, 'triangle', i * 0.13); }
  danger(): void { this.tone(330, 250, 0.4, 0.12, 'sawtooth'); }
  win(): void { [262,330,392,523,659].forEach((f,i) => this.tone(f,f,0.7,0.16,'triangle',i*0.13)); }
  update(dt: number, intensity: number): void {
    if (!this.music || !this.enabled) return;
    this.beatClock -= dt;
    if (this.beatClock > 0) return;
    this.beatClock = 0.26; this.beat++;
    if (this.beat % 4 === 0) this.tone(70,35,0.17,0.07 + intensity * 0.035);
    if (this.beat % 2 === 0) this.tone([65.4,65.4,77.8,58.3][Math.floor(this.beat / 16) % 4], 55,0.21,0.035,'triangle');
    if (this.beat % 8 === 3) this.tone([523,622,784,466][Math.floor(this.beat / 8) % 4],390,0.3,0.018);
  }
}
