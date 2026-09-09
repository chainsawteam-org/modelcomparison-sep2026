import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { Scene, type Stage } from '../core/stage';
import { COLORS, UI, VIEW } from '../game/config';
import { Button } from '../ui/button';
import { FxLayer } from '../fx/particles';
import { Audio } from '../audio/audio';
import { Save } from '../game/storage';
import { fmt } from '../game/hud';
import { orbChip } from '../game/orb-view';
import { glowTexture } from '../core/textures';
import { GameScene } from './game-scene';
import { easeOutCubic, mixColor } from '../core/math';

/** Title screen. Doubles as the rulebook so the game needs no tutorial step. */
export class MenuScene extends Scene {
  private fx = new FxLayer();
  private play: Button;
  private soundBtn: Text;
  private title: Text;
  private titleGlow = new Sprite(glowTexture());
  private drifting: { node: Container; x: number; y: number; sp: number; ph: number; r: number }[] = [];
  private life = 0;
  private intro = 0;
  private content = new Container();

  private onKey = (e: KeyboardEvent) => {
    Audio.unlock();
    const k = e.key.toLowerCase();
    if (k === 'enter' || k === ' ') { e.preventDefault(); this.start(); }
    if (k === 'm') this.toggleSound();
  };

  constructor(stage: Stage) {
    super(stage);

    // ambient orbs drifting behind the title
    const back = new Container();
    for (let i = 0; i < 14; i++) {
      const color = i % COLORS.length;
      const node = orbChip({ id: -100 - i, kind: 'normal', color, units: 1 }, 12 + Math.random() * 16);
      node.alpha = 0.14 + Math.random() * 0.16;
      back.addChild(node);
      this.drifting.push({
        node,
        x: Math.random() * VIEW.w,
        y: 120 + Math.random() * (VIEW.h - 200),
        sp: 14 + Math.random() * 34,
        ph: Math.random() * Math.PI * 2,
        r: 18 + Math.random() * 34,
      });
    }
    this.addChild(back, this.fx, this.content);

    this.titleGlow.anchor.set(0.5);
    this.titleGlow.blendMode = 'add';
    this.titleGlow.tint = UI.accent;
    this.titleGlow.width = 900; this.titleGlow.height = 380;
    this.titleGlow.x = VIEW.w / 2; this.titleGlow.y = 196;
    this.titleGlow.alpha = 0.16;

    this.title = new Text({
      text: 'CHROMA DEPOT',
      style: {
        fill: UI.text, fontSize: 74, fontWeight: '800', letterSpacing: 14,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        dropShadow: { color: 0x000814, alpha: 0.6, blur: 12, distance: 0, angle: 0 },
      },
    });
    this.title.anchor.set(0.5);
    this.title.x = VIEW.w / 2; this.title.y = 186;

    const rule = new Graphics();
    rule.moveTo(VIEW.w / 2 - 250, 232).lineTo(VIEW.w / 2 + 250, 232)
      .stroke({ width: 2, color: UI.line, alpha: 0.9 });

    const tagline = new Text({
      text: 'ORBS KEEP ARRIVING.  THE RAIL ONLY HOLDS EIGHT.',
      style: {
        fill: UI.dim, fontSize: 15, fontWeight: '700', letterSpacing: 4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    tagline.anchor.set(0.5);
    tagline.x = VIEW.w / 2; tagline.y = 258;

    this.content.addChild(this.titleGlow, this.title, rule, tagline, this.buildLegend());

    this.play = new Button({ label: 'START SHIFT', width: 280, height: 62, color: UI.accent, fontSize: 19 });
    this.play.x = VIEW.w / 2; this.play.y = 542;
    this.play.onClick = () => this.start();
    this.content.addChild(this.play);

    const best = new Text({
      text: Save.best > 0 ? `BEST  ${fmt(Save.best)}` : 'NO SHIFT LOGGED YET',
      style: {
        fill: Save.best > 0 ? UI.warn : UI.faint, fontSize: 13, fontWeight: '800', letterSpacing: 3.4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    best.anchor.set(0.5);
    best.x = VIEW.w / 2; best.y = 596;

    const controls = new Text({
      text: 'CLICK OR DRAG AN ORB INTO A BAY     ·     1-4  DEPLOY     ·     SPACE  VENT     ·     P  PAUSE',
      style: {
        fill: UI.faint, fontSize: 11, fontWeight: '700', letterSpacing: 2.2,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    controls.anchor.set(0.5);
    controls.x = VIEW.w / 2; controls.y = 656;

    this.soundBtn = new Text({
      text: Audio.muted ? 'SOUND OFF' : 'SOUND ON',
      style: {
        fill: UI.faint, fontSize: 11, fontWeight: '800', letterSpacing: 2.4,
        fontFamily: 'Segoe UI, system-ui, sans-serif',
      },
    });
    this.soundBtn.anchor.set(0.5);
    this.soundBtn.x = VIEW.w - 46; this.soundBtn.y = 656;
    this.soundBtn.eventMode = 'static';
    this.soundBtn.cursor = 'pointer';
    this.soundBtn.on('pointerover', () => { this.soundBtn.style.fill = UI.text; });
    this.soundBtn.on('pointerout', () => { this.soundBtn.style.fill = UI.faint; });
    this.soundBtn.on('pointertap', () => { Audio.ui(); this.toggleSound(); });

    this.content.addChild(best, controls, this.soundBtn);
  }

  private buildLegend(): Container {
    const wrap = new Container();
    const items = [
      { orb: { id: -1, kind: 'normal' as const, color: 0, units: 1 }, t: 'MATCH', b: 'Send an orb to a bay\nasking for its hue' },
      { orb: { id: -2, kind: 'twin' as const, color: 2, units: 2 }, t: 'TWIN', b: 'Fills two units\nof one order' },
      { orb: { id: -3, kind: 'prism' as const, color: -1, units: 1 }, t: 'PRISM', b: 'Wildcard — every\nbay accepts it' },
      { orb: { id: -4, kind: 'slag' as const, color: -1, units: 1 }, t: 'SLAG', b: 'Useless cargo.\nVent it before it piles up' },
    ];
    const cardW = 234, gap = 18;
    const total = items.length * cardW + (items.length - 1) * gap;
    const x0 = (VIEW.w - total) / 2;
    items.forEach((it, i) => {
      const c = new Container();
      c.x = x0 + i * (cardW + gap);
      c.y = 316;
      const g = new Graphics();
      g.roundRect(0, 0, cardW, 158, 16).fill({ color: 0x0d1228, alpha: 0.82 });
      g.roundRect(0, 0, cardW, 158, 16).stroke({ width: 1.5, color: UI.line, alpha: 0.8 });
      const chip = orbChip(it.orb, 22);
      chip.x = cardW / 2; chip.y = 46;
      const t = new Text({
        text: it.t, style: {
          fill: UI.text, fontSize: 14, fontWeight: '800', letterSpacing: 3,
          fontFamily: 'Segoe UI, system-ui, sans-serif',
        },
      });
      t.anchor.set(0.5); t.x = cardW / 2; t.y = 92;
      const b = new Text({
        text: it.b, style: {
          fill: UI.dim, fontSize: 12, fontWeight: '600', align: 'center', lineHeight: 16,
          fontFamily: 'Segoe UI, system-ui, sans-serif',
        },
      });
      b.anchor.set(0.5, 0); b.x = cardW / 2; b.y = 108;
      c.addChild(g, chip, t, b);
      wrap.addChild(c);
    });
    return wrap;
  }

  private toggleSound(): void {
    const m = !Audio.muted;
    Audio.setMuted(m);
    Save.setMuted(m);
    this.soundBtn.text = m ? 'SOUND OFF' : 'SOUND ON';
  }

  private start(): void {
    Audio.unlock();
    this.stage.go((s) => new GameScene(s));
  }

  override enter(): void {
    window.addEventListener('keydown', this.onKey);
    this.stage.ambient?.setHeat(0);
    Audio.stopMusic();
  }

  override exit(): void {
    window.removeEventListener('keydown', this.onKey);
    this.fx.clear();
  }

  override update(dt: number): void {
    this.life += dt;
    this.intro = Math.min(1, this.intro + dt * 1.6);
    const e = easeOutCubic(this.intro);
    this.content.alpha = e;
    this.content.y = (1 - e) * 22;

    for (const d of this.drifting) {
      d.ph += dt * 0.4;
      d.x += d.sp * dt * 0.2;
      if (d.x > VIEW.w + 60) d.x = -60;
      d.node.x = d.x;
      d.node.y = d.y + Math.sin(d.ph) * d.r;
      d.node.scale.set(1 + Math.sin(d.ph * 0.8) * 0.08);
    }

    const pulse = 0.5 + Math.sin(this.life * 1.4) * 0.5;
    this.titleGlow.alpha = 0.1 + pulse * 0.08;
    this.titleGlow.tint = mixColor(UI.accent, COLORS[Math.floor(this.life * 0.4) % COLORS.length].main, 0.45);
    this.title.scale.set(1 + Math.sin(this.life * 1.1) * 0.006);

    this.play.update(dt);
    this.fx.update(dt);
  }
}
