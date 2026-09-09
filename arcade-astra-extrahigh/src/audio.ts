export class Sound {
  enabled = true;
  private ctx?: AudioContext;
  private master?: GainNode;

  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.16;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch { /* Gameplay remains available if audio is unavailable. */ }
  }

  tone(frequency: number, duration = 0.1, type: OscillatorType = 'sine', delay = 0, volume = 1) {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * 0.45, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain); gain.connect(this.master);
    osc.start(start); osc.stop(start + duration + 0.02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  select(color: number) { this.tone([330, 392, 440, 523, 587][color], 0.08, 'sine', 0, 0.5); }
  launch(count: number, color: number) {
    const base = [262, 330, 392, 440, 523][color];
    for (let i = 0; i < count; i++) this.tone(base * 2 ** (i / 5), 0.26, 'triangle', i * 0.085, 0.8);
    this.tone(base / 2, 0.15, 'sine', 0, 0.7);
  }
  arrival() { this.tone(740, 0.055, 'sine', 0, 0.15); }
  route() { [330, 440, 660].forEach((n, i) => this.tone(n, 0.16, 'sine', i * 0.07, 0.6)); }
  error() { this.tone(130, 0.12, 'triangle', 0, 0.5); }
  warning() { this.tone(220, 0.09, 'triangle', 0, 0.45); }
  finish(win: boolean) {
    const notes = win ? [392, 494, 587, 784] : [330, 294, 220, 165];
    notes.forEach((n, i) => this.tone(n, 0.6, 'triangle', i * 0.14, 0.75));
  }
}
