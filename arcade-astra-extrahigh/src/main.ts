import { Application } from 'pixi.js';
import { Game } from './game';
import './style.css';

async function main() {
  const app = new Application();
  await app.init({
    width: window.innerWidth, height: window.innerHeight,
    background: 0x090f1c, antialias: true, autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl', powerPreference: 'high-performance',
  });
  document.querySelector('#app')!.appendChild(app.canvas);
  const game = new Game(app);
  // Vite removes this branch (and the fixture module) from the production build.
  if (import.meta.env.DEV) {
    const fixture = new URLSearchParams(window.location.search).get('fixture');
    if (fixture) {
      const { applyFixture } = await import('../tests/fixtures');
      applyFixture(game.model, fixture);
    }
  }
  document.querySelector('#loading')?.remove();
}

main().catch((error: unknown) => {
  console.error('Lumen could not start:', error);
  const loading = document.querySelector('#loading');
  if (loading) {
    loading.textContent = 'Lumen could not start. Enable WebGL in your browser and reload.';
    (loading as HTMLElement).style.cssText = 'padding:40px;font-size:16px;letter-spacing:0;text-align:center;line-height:1.6';
  }
});
