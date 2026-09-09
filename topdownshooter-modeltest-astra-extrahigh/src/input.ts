export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: innerWidth * 0.6, y: innerHeight * 0.4, down: false };
  onPause: () => void = () => {};
  constructor(canvas: HTMLCanvasElement) {
    addEventListener('keydown', e => {
      if (['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('pointermove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
    canvas.addEventListener('pointerdown', e => { if (e.button === 0) this.mouse.down = true; });
    addEventListener('pointerup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => { this.clear(); this.onPause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); this.onPause(); } });
  }
  consume(code: string): boolean { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  endFrame(): void { this.pressed.clear(); }
  clear(): void { this.keys.clear(); this.pressed.clear(); this.mouse.down = false; }
}
