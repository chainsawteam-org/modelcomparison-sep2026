import { Container, Graphics, Rectangle } from 'pixi.js';
import { BOARD, BUFFER, CAPACITY, COLORS, LANES, UI, laneX, packetX, tileY } from './config';
import { chip, label, line, micro, panel, symbol } from './draw';
import type { GameModel, Tile } from './model';

type Visual = { root: Container; x: number; y: number; age: number; hp?: number };

export class BoardView {
  root = new Container();
  private tiles = new Map<number, Visual>();
  private packets = new Map<number, Visual>();
  private tileLayer = new Container();
  private packetLayer = new Container();
  private highlights = new Graphics();
  private paths = new Graphics();
  private laneHover = -1;
  private packetHover = -1;
  private time = 0;
  private caption;
  private bufferStatus;
  private laneButtons: Container[] = [];
  private packetButtons: Container[] = [];

  constructor(private model: GameModel, private onLane: (index: number) => void, private onPacket: (index: number) => void) {
    micro(this.root, 'TARGET ARRAY', BOARD.x, 115);
    micro(this.root, 'CLEAR FROM THE BOTTOM UP', 749, 115, UI.dim, 9);
    panel(this.root, BOARD.x, BOARD.y, BOARD.w, BOARD.h, UI.inset, 16);
    const bg = new Graphics();
    for (let i = 0; i < LANES; i++) {
      const x = laneX(i);
      bg.roundRect(x - 46, 156, 92, 326, 10).fill({ color: 0x142237, alpha: 0.5 });
      line(bg, x, 164, x, 477, 0x2a3e56, 0.24);
      for (let j = 0; j < 7; j++) line(bg, x - 35, tileY(j), x + 35, tileY(j), 0x26394e, 0.2);
      const n = micro(this.root, `0${i + 1}`, x, 491, UI.muted, 9); n.anchor.set(0.5);
    }
    this.root.addChildAt(bg, 3);
    this.root.addChild(this.paths, this.highlights, this.tileLayer);
    panel(this.root, BUFFER.x, BUFFER.y, BUFFER.w, BUFFER.h, UI.panel, 14);
    micro(this.root, 'PACKET BUFFER', 330, 551);
    this.bufferStatus = micro(this.root, '05 / 10', 901, 551, UI.muted, 10);
    const slots = new Graphics();
    for (let i = 0; i < CAPACITY; i++) {
      slots.roundRect(packetX(i) - 25, BUFFER.cy - 25, 50, 50, 10).fill(UI.inset).stroke({ color: UI.line, alpha: 0.7, width: 1 });
      slots.circle(packetX(i), BUFFER.cy, 2).fill(UI.line);
      const n = label(this.root, i === 9 ? '0' : `${i + 1}`, packetX(i), 639, 9, UI.dim); n.anchor.set(0.5);
    }
    this.root.addChild(slots, this.packetLayer);
    this.caption = label(this.root, 'Select a packet. Matching neighbors link together.', 640, 677, 12, UI.muted); this.caption.anchor.set(0.5);
    for (let i = 0; i < LANES; i++) {
      const target = new Container(); target.eventMode = 'static'; target.cursor = 'pointer';
      target.hitArea = new Rectangle(laneX(i) - 47, 155, 94, 350);
      target.on('pointerover', () => { this.laneHover = i; });
      target.on('pointerout', () => { if (this.laneHover === i) this.laneHover = -1; });
      target.on('pointertap', () => this.onLane(i));
      this.root.addChild(target); this.laneButtons.push(target);
    }
    for (let i = 0; i < CAPACITY; i++) {
      const target = new Container(); target.eventMode = 'static'; target.cursor = 'pointer';
      target.hitArea = new Rectangle(packetX(i) - 30, BUFFER.cy - 30, 60, 60);
      target.on('pointerover', () => { this.packetHover = i; });
      target.on('pointerout', () => { if (this.packetHover === i) this.packetHover = -1; });
      target.on('pointertap', () => this.onPacket(i));
      this.root.addChild(target); this.packetButtons.push(target);
    }
  }

  private drawTile(tile: Tile) {
    const color = COLORS[tile.color];
    const g = new Graphics();
    g.roundRect(-38, -18.5 + 3, 76, 37, 7).fill({ color: 0x000000, alpha: 0.32 });
    g.roundRect(-38, -18.5, 76, 37, 7).fill(color.dark).stroke({ color: color.hex, alpha: 0.7, width: 1 });
    g.roundRect(-36, -17, 72, 16, 5).fill({ color: color.hex, alpha: 0.1 });
    g.roundRect(-38, -10, 3, 20, 1).fill({ color: color.hex, alpha: 0.9 });
    symbol(g, tile.color, 0, 0, 8, color.hex);
    if (tile.hp > 1) {
      g.poly([22, -10, 30, -10, 30, -3, 26, 1, 22, -3]).stroke({ color: color.hex, width: 1.3, alpha: 0.9 });
      g.circle(23, 10, 1.5).fill(color.hex).circle(29, 10, 1.5).fill(color.hex);
      g.roundRect(-34, -15, 68, 30, 5).stroke({ color: color.hex, width: 1, alpha: 0.22 });
    } else if (tile.shield) {
      line(g, 23, -9, 27, -3, color.hex, 0.6); line(g, 27, -3, 24, 3, color.hex, 0.6);
    }
    return g;
  }

  reset() {
    this.tiles.forEach(v => v.root.destroy({ children: true })); this.tiles.clear();
    this.packets.forEach(v => v.root.destroy({ children: true })); this.packets.clear();
    this.laneHover = -1; this.packetHover = -1;
  }

  tick(dt: number, reduced: boolean) {
    this.time += dt;
    const m = this.model, selected = m.selected, color = selected[0]?.color;
    const active = m.mode === 'playing';
    const selectedIds = new Set(selected.map(p => p.id));
    const tileIds = new Set<number>();
    const smoothing = reduced ? 1 : 1 - Math.exp(-18 * dt);
    this.highlights.clear(); this.paths.clear();
    m.lanes.forEach((lane, i) => {
      const x = laneX(i), match = color !== undefined && lane[0]?.color === color;
      const route = active && m.routing && lane.length > 1 && lane.some(t => t.color !== lane[0].color);
      const ink = route ? UI.mint : match ? COLORS[color!].hex : UI.line;
      if (active && (match || route)) {
        this.highlights.roundRect(x - 46, 156, 92, 326, 10).fill({ color: ink, alpha: this.laneHover === i ? 0.09 : 0.025 }).stroke({ color: ink, width: 1, alpha: 0.38 });
        this.highlights.poly([x - 5, 483, x, 478, x + 5, 483]).stroke({ color: ink, width: 1.5 });
      }
      if (this.laneHover === i && match && active) {
        let ammo = selected.length;
        for (let r = 0; r < lane.length; r++) {
          const tile = lane[r]; if (tile.color !== color || ammo <= 0) break;
          this.highlights.roundRect(x - 41, tileY(r) - 21.5, 82, 43, 8).stroke({ color: ink, width: 2, alpha: 0.9 });
          ammo -= tile.hp;
        }
        const avgX = selected.reduce((sum, p) => sum + packetX(m.queue.indexOf(p)), 0) / selected.length;
        this.paths.moveTo(avgX, 574).lineTo(avgX, 523).lineTo(x, 523).lineTo(x, 479).stroke({ color: ink, width: 1.5, alpha: 0.35 });
      }
      if (!lane.length) {
        this.highlights.circle(x, 318, 17).stroke({ color: UI.mint, width: 1, alpha: 0.25 });
        this.highlights.moveTo(x - 6, 318).lineTo(x - 1, 323).lineTo(x + 7, 313).stroke({ color: UI.mint, alpha: 0.55, width: 1.5 });
      }
      lane.forEach((tile, row) => {
        tileIds.add(tile.id);
        let v = this.tiles.get(tile.id);
        if (!v) {
          const root = new Container(); root.addChild(this.drawTile(tile)); this.tileLayer.addChild(root);
          root.position.set(x, tileY(row) - (reduced || m.mode === 'ready' ? 0 : 12));
          v = { root, x, y: tileY(row), age: reduced || m.mode === 'ready' ? 1 : -row * 0.012 - i * 0.009, hp: tile.hp }; this.tiles.set(tile.id, v);
        }
        if (v.hp !== tile.hp) { v.root.removeChildren().forEach(c => c.destroy()); v.root.addChild(this.drawTile(tile)); v.hp = tile.hp; }
        v.age += dt; v.y = tileY(row);
        v.root.y += (v.y - v.root.y) * smoothing;
        v.root.alpha = Math.min(1, Math.max(0, v.age * 6)) * (active && color !== undefined && !match ? 0.65 : 1);
        const emphasis = row === 0 && match && active ? 1.025 : 1;
        v.root.scale.set(emphasis);
      });
      this.laneButtons[i].cursor = active && (match || route) ? 'pointer' : 'default';
    });
    this.tiles.forEach((v, id) => { if (!tileIds.has(id)) { v.root.destroy({ children: true }); this.tiles.delete(id); } });
    const packetIds = new Set<number>();
    m.queue.forEach((packet, index) => {
      packetIds.add(packet.id);
      let v = this.packets.get(packet.id);
      if (!v) {
        const root = new Container(); root.addChild(chip(packet.color)); this.packetLayer.addChild(root);
        root.position.set(packetX(index) + (reduced || m.mode === 'ready' ? 0 : 35), BUFFER.cy);
        v = { root, x: packetX(index), y: BUFFER.cy, age: reduced || m.mode === 'ready' ? 1 : 0 }; this.packets.set(packet.id, v);
      }
      v.age += dt;
      const isSelected = selectedIds.has(packet.id);
      v.x = packetX(index); v.y = BUFFER.cy - (isSelected ? 7 : index === this.packetHover && active ? 3 : 0);
      v.root.x += (v.x - v.root.x) * smoothing; v.root.y += (v.y - v.root.y) * smoothing;
      v.root.alpha = Math.min(1, v.age * 8);
      v.root.scale.set(isSelected ? 1.06 : 1);
      if (isSelected) {
        const g = v.root.children[0] as Graphics;
        g.tint = 0xffffff;
      }
    });
    this.packets.forEach((v, id) => { if (!packetIds.has(id)) { v.root.destroy({ children: true }); this.packets.delete(id); } });
    this.packetButtons.forEach((b, i) => { b.cursor = active && i < m.queue.length ? 'pointer' : 'default'; });
    if (selected.length) {
      const first = m.queue.indexOf(selected[0]), last = m.queue.indexOf(selected[selected.length - 1]);
      const x = packetX(first) - 28, right = packetX(last) + 28;
      this.paths.moveTo(x, 572).lineTo(x, 568).lineTo(right, 568).lineTo(right, 572).stroke({ color: COLORS[color!].hex, width: 1.5 });
    }
    this.bufferStatus.text = `${String(m.queue.length).padStart(2, '0')} / 10`;
    this.bufferStatus.style.fill = m.queue.length >= 8 ? UI.danger : UI.muted;
    if (m.queue.length >= 8) {
      this.paths.roundRect(BUFFER.x, BUFFER.y, BUFFER.w, BUFFER.h, 14).stroke({ color: UI.danger, width: 1.3, alpha: 0.35 + Math.sin(this.time * 4) * 0.15 });
    }
    let caption = 'Select a packet. Matching neighbors link together.';
    if (m.mode === 'ready') caption = 'A little order. A lot of possibility.';
    else if (m.routing) caption = 'Click a lane to move its front color run to the back.  •  Esc to cancel';
    else if (selected.length) {
      const matching = m.lanes.some(l => l[0]?.color === color);
      const prediction = this.laneHover >= 0 ? m.preview(this.laneHover) : null;
      caption = matching ? `${selected.length} ${COLORS[color!].name.toLowerCase()} packet${selected.length > 1 ? 's' : ''} linked  ·  Click a glowing lane to launch`
        : 'No matching front target. Select another color or reroute a lane.';
      if (prediction?.hits) caption = `${prediction.clears} target${prediction.clears === 1 ? '' : 's'} cleared  ·  ${prediction.hits} packet${prediction.hits === 1 ? '' : 's'} used${prediction.hits < selected.length ? `  ·  ${selected.length - prediction.hits} kept in buffer` : ''}`;
    }
    if (m.overflowTime > 0) caption = `BUFFER FULL  ·  Launch a packet within ${Math.max(0, 5 - m.overflowTime).toFixed(1)}s`;
    this.caption.text = caption;
    this.caption.style.fill = m.overflowTime > 0 ? UI.danger : selected.length || m.routing ? UI.mint : UI.muted;
  }
}
