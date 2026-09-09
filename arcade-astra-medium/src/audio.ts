export class Sound {
  muted = false;
  private context: AudioContext | null = null;
  constructor() { try { this.muted = localStorage.getItem('chroma-muted') === 'true'; } catch { /* optional storage */ } }
  unlock() {
    try { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); } catch { /* silent mode */ }
  }
  toggle() { this.muted = !this.muted; this.unlock(); try { localStorage.setItem('chroma-muted', String(this.muted)); } catch { /* optional storage */ } }
  tone(frequency: number, duration = 0.12, volume = 0.045, delay = 0, type: OscillatorType = 'sine') {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(now); oscillator.stop(now + duration + 0.03);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  select(color: number) { this.tone([330, 392, 440, 523][color], 0.08, 0.035); }
  send(color: number, perfect: boolean) {
    const root = [440, 523, 587, 659][color];
    this.tone(root, 0.18);
    if (perfect) [1.25, 1.5, 2].forEach((n, i) => this.tone(root * n, 0.24, 0.035, 0.045 * (i + 1)));
  }
  clear() { [660, 880, 1100].forEach((n, i) => this.tone(n, 0.25, 0.025, i * 0.065)); }
  stage() { [440, 554, 659, 880].forEach((n, i) => this.tone(n, 0.4, 0.04, i * 0.11)); }
}
