import { Stage } from './core/stage';
import { warmTextures } from './core/textures';
import { Backdrop } from './fx/backdrop';
import { Audio } from './audio/audio';
import { Save } from './game/storage';
import { MenuScene } from './scenes/menu-scene';

async function boot(): Promise<void> {
  const host = document.getElementById('app')!;
  const stage = new Stage();
  await stage.init(host);

  warmTextures();

  const backdrop = new Backdrop();
  backdrop.resize(stage.width, stage.height);
  stage.backdrop.addChild(backdrop);
  stage.ambient = backdrop;

  Audio.muted = Save.muted;
  // Browsers block audio until a gesture; unlock on the first one, whatever it is.
  const unlock = () => Audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  stage.go((s) => new MenuScene(s), true);

  document.getElementById('boot')?.classList.add('hidden');
  window.setTimeout(() => document.getElementById('boot')?.remove(), 600);
}

void boot();
