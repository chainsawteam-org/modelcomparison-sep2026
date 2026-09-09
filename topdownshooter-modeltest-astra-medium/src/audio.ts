export class AudioEngine {
  context: AudioContext | null = null;
  enabled = true;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume();
  }
  tone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    gain = 0.05,
    end = freq,
  ) {
    if (!this.enabled || !this.context) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(20, end),
      c.currentTime + duration,
    );
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }
  shoot(heavy = false) {
    this.tone(heavy ? 120 : 240, 0.09, "sawtooth", heavy ? 0.065 : 0.027, 45);
  }
  hit() {
    this.tone(420, 0.055, "triangle", 0.035, 110);
  }
  kill() {
    this.tone(95, 0.2, "sawtooth", 0.04, 26);
  }
  hurt() {
    this.tone(130, 0.24, "square", 0.06, 40);
  }
  pickup() {
    this.tone(700, 0.09, "sine", 0.025, 1100);
  }
  dash() {
    this.tone(220, 0.15, "triangle", 0.05, 850);
  }
  boom() {
    this.tone(75, 0.5, "sawtooth", 0.12, 20);
  }
}
