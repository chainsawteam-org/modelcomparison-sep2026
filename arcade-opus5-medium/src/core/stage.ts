import { Application, Container, Graphics } from 'pixi.js';
import { VIEW } from '../game/config';
import { clamp } from './math';

/** A screen. Scenes own their own display objects and are destroyed on exit. */
export abstract class Scene extends Container {
  constructor(protected stage: Stage) { super(); }
  abstract update(dt: number): void;
  /** Called once the scene is on screen and the fade has started clearing. */
  enter(): void {}
  /** Called right before destruction. */
  exit(): void {}
  /** Window resized; `w`/`h` are always VIEW-sized, but backgrounds may care. */
  resize(): void {}
}

type SceneFactory = (stage: Stage) => Scene;

/**
 * Owns the Pixi application, the letterboxed 1280x720 world transform and a
 * fade-through scene transition.
 */
export class Stage {
  readonly app = new Application();
  /** Un-scaled, window-sized layer used for the ambient background. */
  readonly backdrop = new Container();
  /** Scaled + centred game world. Camera shake is applied here. */
  readonly world = new Container();
  readonly camera = new Container();
  /** Above everything, used for the transition veil. */
  readonly overlay = new Container();

  scene: Scene | null = null;
  /** Optional window-filling ambient layer, ticked and resized with the app. */
  ambient: { update(dt: number): void; resize(w: number, h: number): void; setHeat(v: number): void } | null = null;
  scale = 1;
  private veil = new Graphics();
  private fade = 0;
  private fadeDir = 0;
  private pending: SceneFactory | null = null;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      background: 0x05060d,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      resizeTo: host,
      preference: 'webgl',
    });
    host.appendChild(this.app.canvas);

    this.world.addChild(this.camera);
    this.app.stage.addChild(this.backdrop, this.world, this.overlay);
    this.overlay.addChild(this.veil);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.overlay.eventMode = 'none';
    this.veil.eventMode = 'none';

    this.app.renderer.on('resize', () => this.layout());
    this.layout();

    this.app.ticker.maxFPS = 120;
    this.app.ticker.add((ticker) => {
      // Clamp so an alt-tabbed tab does not resume with a giant time step.
      const dt = clamp(ticker.deltaMS / 1000, 0, 1 / 20);
      this.tick(dt);
    });
  }

  get width(): number { return this.app.renderer.width / this.app.renderer.resolution; }
  get height(): number { return this.app.renderer.height / this.app.renderer.resolution; }

  private layout(): void {
    const w = this.width, h = this.height;
    this.scale = Math.min(w / VIEW.w, h / VIEW.h);
    this.world.scale.set(this.scale);
    this.world.x = Math.round((w - VIEW.w * this.scale) / 2);
    this.world.y = Math.round((h - VIEW.h * this.scale) / 2);
    this.veil.clear().rect(0, 0, w, h).fill({ color: 0x05060d });
    this.ambient?.resize(w, h);
    this.scene?.resize();
  }

  /** Swap scenes with a short fade to black. */
  go(factory: SceneFactory, instant = false): void {
    if (instant || !this.scene) {
      this.mount(factory);
      this.fade = 1; this.fadeDir = -1;
      return;
    }
    this.pending = factory;
    this.fadeDir = 1;
  }

  private mount(factory: SceneFactory): void {
    if (this.scene) { this.scene.exit(); this.camera.removeChild(this.scene); this.scene.destroy({ children: true }); }
    this.scene = factory(this);
    this.camera.addChild(this.scene);
    this.scene.resize();
    this.scene.enter();
  }

  private tick(dt: number): void {
    if (this.fadeDir !== 0) {
      this.fade = clamp(this.fade + this.fadeDir * dt * 3.6, 0, 1);
      if (this.fadeDir > 0 && this.fade >= 1 && this.pending) {
        this.mount(this.pending);
        this.pending = null;
        this.fadeDir = -1;
      } else if (this.fadeDir < 0 && this.fade <= 0) {
        this.fadeDir = 0;
      }
    }
    this.ambient?.update(dt);
    this.veil.alpha = this.fade;
    this.veil.visible = this.fade > 0.001;
    this.scene?.update(dt);
  }
}
