import { menu, resume, pause, notice, upgrade, finish, hud } from "./ui";
import * as T from "three";
import { World, actor, ring, glow } from "./world";
import { AudioEngine } from "./audio";
const $ = (id: string) => document.getElementById(id)!;
type Enemy = {
  mesh: T.Group;
  type: string;
  hp: number;
  max: number;
  x: number;
  z: number;
  r: number;
  cool: number;
  tell: number;
  dx: number;
  dz: number;
  flash: number;
  charge: number;
  nx: number;
  nz: number;
  navTimer: number;
};
type Bullet = {
  mesh: T.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  enemy: boolean;
  damage: number;
  pierce: number;
  hit: Set<Enemy>;
};
type Particle = {
  mesh: T.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
};
type Pickup = {
  mesh: T.Mesh;
  x: number;
  z: number;
  life: number;
  health: boolean;
};
type Spawn = { mesh: T.Mesh; x: number; z: number; type: string; t: number };
type Hazard = { mesh: T.Mesh; x: number; z: number; t: number; fired: boolean };
export class Game {
  world: World;
  audio = new AudioEngine();
  state = "menu";
  player = actor("player");
  x = 0;
  z = 3;
  vx = 0;
  vz = 0;
  hp = 100;
  maxHp = 100;
  invuln = 0;
  dash = 0;
  dashTime = 0;
  energy = 0;
  weapon = 0;
  ammo = [24, 7];
  reload = 0;
  shot = 0;
  angle = 0;
  keys = new Set<string>();
  mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  pickups: Pickup[] = [];
  spawns: Spawn[] = [];
  hazards: Hazard[] = [];
  wave = 1;
  waveTime = 0;
  spawnTimer = 2;
  hazardTimer = 10;
  score = 0;
  kills = 0;
  combo = 0;
  comboTime = 0;
  elapsed = 0;
  shake = 0;
  noticeTime = 0;
  damageFlash = 0;
  hitFlash = 0;
  best = 0;
  last = 0;
  bossSpawned = false;
  upgrades = new Set<string>();
  fireRate = 1;
  damage = 1;
  speed = 1;
  dashMax = 2.2;
  constructor() {
    this.world = new World($("scene") as HTMLCanvasElement);
    this.world.root.add(this.player);
    this.player.position.set(0, 0, 3);
    try {
      this.best = Number(localStorage.getItem("ember-best") || 0);
    } catch {}
    this.bind();
    this.menu();
    requestAnimationFrame((t) => this.frame(t));
  }
  bind() {
    window.addEventListener("keydown", (e) => {
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "Escape") {
        if (this.state === "playing") this.pause();
        else if (this.state === "paused") this.resume();
      }
      if (this.state !== "playing") return;
      if (e.code === "KeyR") this.startReload();
      if (e.code === "Digit1" || e.code === "Digit2") {
        this.weapon = e.code === "Digit1" ? 0 : 1;
        this.reload = 0;
        this.audio.tone(300, 0.06);
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.doDash();
      if (e.code === "Space") this.discharge();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("mousemove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      $("crosshair").style.left = e.clientX + "px";
      $("crosshair").style.top = e.clientY + "px";
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0 && e.target === $("scene")) {
        this.mouse.down = true;
        this.audio.unlock();
      }
    });
    window.addEventListener("mouseup", () => (this.mouse.down = false));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouse.down = false;
      if (this.state === "playing") this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.pause();
    });
    $("sound").onclick = () => {
      this.audio.enabled = !this.audio.enabled;
      $("sound").textContent = this.audio.enabled ? "SOUND ON" : "SOUND OFF";
    };
  }
  menu = menu.bind(this);
  removeMesh(mesh: T.Object3D) {
    this.world.root.remove(mesh);
    mesh.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m instanceof T.MeshBasicMaterial) m.dispose();
      }
    });
  }
  clear() {
    for (const collection of [
      this.enemies,
      this.bullets,
      this.particles,
      this.pickups,
      this.spawns,
      this.hazards,
    ]) {
      for (const item of collection) this.removeMesh(item.mesh);
      collection.length = 0;
    }
  }
  start() {
    this.audio.unlock();
    this.clear();
    Object.assign(this, {
      x: 0,
      z: 3,
      vx: 0,
      vz: 0,
      hp: 100,
      maxHp: 100,
      invuln: 1,
      dash: 0,
      dashTime: 0,
      energy: 0,
      weapon: 0,
      ammo: [24, 7],
      reload: 0,
      shot: 0,
      wave: 1,
      waveTime: 0,
      spawnTimer: 1.8,
      hazardTimer: 10,
      score: 0,
      kills: 0,
      combo: 0,
      comboTime: 0,
      elapsed: 0,
      shake: 0,
      bossSpawned: false,
      fireRate: 1,
      damage: 1,
      speed: 1,
      dashMax: 2.2,
    });
    this.upgrades.clear();
    this.keys.clear();
    this.mouse.down = false;
    this.player.visible = true;
    $("hud").hidden = false;
    this.resume();
    this.notice("01 / ESTABLISH CONTROL", 4);
  }
  resume = resume.bind(this);
  pause = pause.bind(this);
  notice = notice.bind(this);
  capacity() {
    return this.weapon === 0 ? 24 : 7;
  }
  startReload() {
    if (this.reload <= 0 && this.ammo[this.weapon] < this.capacity()) {
      this.reload = this.weapon === 0 ? 1.15 : 1.5;
      this.audio.tone(180, 0.1, "triangle");
    }
  }
  doDash() {
    if (this.dash > 0) return;
    let dx = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
      dz = Number(this.keys.has("KeyS")) - Number(this.keys.has("KeyW"));
    let len = Math.hypot(dx, dz);
    if (!len) {
      dx = Math.sin(this.angle);
      dz = Math.cos(this.angle);
      len = 1;
    }
    this.vx = (dx / len) * 27;
    this.vz = (dz / len) * 27;
    this.dashTime = 0.18;
    this.invuln = 0.3;
    this.dash = this.dashMax;
    this.audio.dash();
    if (this.upgrades.has("wake")) this.radial(this.x, this.z, 10, 1.1);
  }
  discharge() {
    if (this.energy < 100) return;
    this.energy = 0;
    this.audio.boom();
    this.shake = 0.5;
    this.burst(this.x, this.z, 0xffbb72, 45, 10);
    for (const e of [...this.enemies])
      if (Math.hypot(e.x - this.x, e.z - this.z) < 8.5) this.hit(e, 90);
    for (const b of [...this.bullets]) if (b.enemy) this.removeBullet(b);
    this.radial(this.x, this.z, 18, 1.2);
    this.invuln = 0.7;
    this.notice("DISCHARGE / FIELD CLEARED", 1.2);
  }
  radial(x: number, z: number, count: number, damage: number) {
    for (let i = 0; i < count; i++)
      this.bullet(x, z, (i / count) * Math.PI * 2, 26, false, 16 * damage, 1);
  }
  blocked(x: number, z: number, r: number) {
    return this.world.obstacles.some(
      (o) => Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r,
    );
  }
  lineBlocked(x: number, z: number, tx: number, tz: number, r: number) {
    return this.world.obstacles.some((o) => {
      let lo = 0,
        hi = 1;
      for (const [start, delta, min, max] of [
        [x, tx - x, o.x - o.w / 2 - r, o.x + o.w / 2 + r],
        [z, tz - z, o.z - o.d / 2 - r, o.z + o.d / 2 + r],
      ]) {
        if (Math.abs(delta) < 0.00001) {
          if (start < min || start > max) return false;
        } else {
          let a = (min - start) / delta,
            b = (max - start) / delta;
          if (a > b) [a, b] = [b, a];
          lo = Math.max(lo, a);
          hi = Math.min(hi, b);
          if (lo > hi) return false;
        }
      }
      return true;
    });
  }
  waypoint(x: number, z: number, tx: number, tz: number, r: number) {
    const nodes = [
      { x, z },
      { x: tx, z: tz },
    ];
    for (const o of this.world.obstacles)
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          nodes.push({
            x: o.x + sx * (o.w / 2 + r + 0.15),
            z: o.z + sz * (o.d / 2 + r + 0.15),
          });
    const dist = nodes.map(() => Infinity),
      prev = nodes.map(() => -1),
      seen = new Set<number>();
    dist[0] = 0;
    for (let k = 0; k < nodes.length; k++) {
      let at = -1;
      for (let i = 0; i < nodes.length; i++)
        if (!seen.has(i) && (at < 0 || dist[i] < dist[at])) at = i;
      if (at < 0 || !Number.isFinite(dist[at])) break;
      if (at === 1) break;
      seen.add(at);
      for (let j = 0; j < nodes.length; j++) {
        if (
          seen.has(j) ||
          this.lineBlocked(nodes[at].x, nodes[at].z, nodes[j].x, nodes[j].z, r)
        )
          continue;
        const d =
          dist[at] +
          Math.hypot(nodes[j].x - nodes[at].x, nodes[j].z - nodes[at].z);
        if (d < dist[j]) {
          dist[j] = d;
          prev[j] = at;
        }
      }
    }
    let at = 1;
    while (prev[at] > 0) at = prev[at];
    return prev[at] === 0 ? nodes[at] : { x: tx, z: tz };
  }
  move(entity: { x: number; z: number }, dx: number, dz: number, r: number) {
    let nx = T.MathUtils.clamp(entity.x + dx, -19.65 + r, 19.65 - r),
      nz = T.MathUtils.clamp(entity.z + dz, -14.65 + r, 14.65 - r);
    if (!this.blocked(nx, entity.z, r)) entity.x = nx;
    if (!this.blocked(entity.x, nz, r)) entity.z = nz;
  }
  bullet(
    x: number,
    z: number,
    a: number,
    speed: number,
    enemy: boolean,
    damage: number,
    pierce = 0,
  ) {
    const mesh = new T.Mesh(
      new T.SphereGeometry(enemy ? 0.15 : 0.085, 6, 4),
      glow(enemy ? 0xff6855 : 0xffe6ab),
    );
    mesh.scale.z = enemy ? 1 : 3.5;
    mesh.rotation.y = a;
    mesh.position.set(x, 0.72, z);
    this.world.root.add(mesh);
    this.bullets.push({
      mesh,
      x,
      z,
      vx: Math.sin(a) * speed,
      vz: Math.cos(a) * speed,
      life: enemy ? 5 : 1.15,
      enemy,
      damage,
      pierce,
      hit: new Set(),
    });
  }
  shoot() {
    if (this.shot > 0 || this.reload > 0) return;
    if (this.ammo[this.weapon] <= 0) {
      this.startReload();
      return;
    }
    this.ammo[this.weapon]--;
    const scatter = this.weapon === 1;
    this.shot = (scatter ? 0.48 : 0.115) / this.fireRate;
    this.audio.shoot(scatter);
    const a = this.angle;
    const x = this.x + Math.sin(a) * 0.9 + Math.cos(a) * 0.35,
      z = this.z + Math.cos(a) * 0.9 - Math.sin(a) * 0.35;
    const n = scatter ? 7 : 1;
    for (let i = 0; i < n; i++) {
      const spread = scatter ? (i - 3) * 0.075 : (Math.random() - 0.5) * 0.022;
      this.bullet(
        x,
        z,
        a + spread,
        scatter ? 35 : 43,
        false,
        (scatter ? 12 : 19) * this.damage,
        this.upgrades.has("pierce") ? 2 : 0,
      );
    }
    this.burst(x, z, 0xffdb96, scatter ? 6 : 3, 2);
    this.shake = Math.max(this.shake, scatter ? 0.13 : 0.04);
    if (this.ammo[this.weapon] === 0) this.startReload();
  }
  burst(x: number, z: number, color: number, count: number, speed = 4) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 240) break;
      const mesh = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.1), glow(color));
      mesh.position.set(x, 0.6, z);
      const a = Math.random() * Math.PI * 2,
        life = 0.25 + Math.random() * 0.4;
      this.world.root.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(a) * speed * Math.random(),
        vy: 2 + Math.random() * 4,
        vz: Math.sin(a) * speed * Math.random(),
        life,
        max: life,
      });
    }
  }
  hit(e: Enemy, damage: number) {
    e.hp -= damage;
    e.flash = 0.09;
    this.hitFlash = 0.08;
    this.audio.hit();
    this.burst(e.x, e.z, 0xffd19d, 3, 3);
    if (e.hp <= 0) {
      this.removeMesh(e.mesh);
      this.enemies.splice(this.enemies.indexOf(e), 1);
      this.kills++;
      this.combo = Math.min(20, this.combo + 1);
      this.comboTime = 3.5;
      this.score += Math.round(
        (e.type === "boss"
          ? 2500
          : e.type === "charger"
            ? 160
            : e.type === "ranger"
              ? 120
              : 70) *
          (1 + Math.floor(this.combo / 4) * 0.25),
      );
      this.audio.kill();
      this.burst(
        e.x,
        e.z,
        e.type === "ranger" ? 0x8dd9e6 : 0xff9661,
        e.type === "boss" ? 50 : 14,
        6,
      );
      this.shake = Math.max(this.shake, 0.14);
      this.drop(e.x, e.z, Math.random() < 0.13);
      if (this.upgrades.has("volatile"))
        for (const other of [...this.enemies])
          if (Math.hypot(e.x - other.x, e.z - other.z) < 2.6) {
            other.hp -= 20;
            other.flash = 0.1;
          }
      if (e.type === "boss") {
        this.finish(true);
      }
    }
  }
  drop(x: number, z: number, health: boolean) {
    const mesh = new T.Mesh(
      new T.OctahedronGeometry(health ? 0.25 : 0.17),
      glow(health ? 0xa1ffd0 : 0xffbc6b),
    );
    mesh.position.set(x, 0.4, z);
    this.world.root.add(mesh);
    this.pickups.push({ mesh, x, z, life: 22, health });
  }
  hurt(amount: number) {
    if (this.invuln > 0 || this.state !== "playing") return;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = 0.65;
    this.damageFlash = 0.65;
    this.shake = 0.35;
    this.combo = 0;
    this.audio.hurt();
    this.burst(this.x, this.z, 0xaaffd7, 9, 4);
    if (this.hp <= 0) this.finish(false);
  }
  queue(type: string) {
    let x = 0,
      z = 0;
    for (let i = 0; i < 20; i++) {
      const edge = Math.floor(Math.random() * 4);
      x = edge < 2 ? (edge === 0 ? -18.4 : 18.4) : (Math.random() - 0.5) * 34;
      z = edge >= 2 ? (edge === 2 ? -13.4 : 13.4) : (Math.random() - 0.5) * 23;
      if (Math.hypot(x - this.x, z - this.z) > 8 && !this.blocked(x, z, 1))
        break;
    }
    const mesh = ring(type === "boss" ? 2 : 0.9, 0xf08e63);
    mesh.position.x = x;
    mesh.position.z = z;
    this.world.root.add(mesh);
    this.spawns.push({ mesh, x, z, type, t: 1.3 });
  }
  spawn(s: Spawn) {
    const mesh = actor(s.type);
    mesh.position.set(s.x, 0, s.z);
    this.world.root.add(mesh);
    const hp =
      s.type === "boss"
        ? 1900
        : s.type === "charger"
          ? 115
          : s.type === "ranger"
            ? 65
            : 42;
    this.enemies.push({
      mesh,
      type: s.type,
      hp,
      max: hp,
      x: s.x,
      z: s.z,
      r: s.type === "boss" ? 1.6 : 0.55,
      cool: 1.3 + Math.random(),
      tell: 0,
      dx: 0,
      dz: 0,
      flash: 0,
      charge: 0,
      nx: s.x,
      nz: s.z,
      navTimer: 0,
    });
  }
  enemyStep(e: Enemy, dt: number) {
    if (e.hp <= 0) {
      this.hit(e, 0);
      return;
    }
    const dx = this.x - e.x,
      dz = this.z - e.z,
      d = Math.hypot(dx, dz) || 0.01;
    const a = Math.atan2(dx, dz);
    e.cool -= dt;
    e.flash = Math.max(0, e.flash - dt);
    let mx = 0,
      mz = 0;
    if (e.type === "charger") {
      if (e.tell > 0) {
        e.tell -= dt;
        if (e.tell <= 0) {
          e.charge = 0.55;
          e.cool = 2.6;
          this.audio.tone(100, 0.2, "sawtooth", 0.035, 240);
        }
      } else if (e.charge > 0) {
        e.charge -= dt;
        mx = e.dx * 17;
        mz = e.dz * 17;
      } else if (e.cool <= 0 && d < 13) {
        e.tell = 0.8;
        e.dx = dx / d;
        e.dz = dz / d;
      } else {
        mx = (dx / d) * 2.4;
        mz = (dz / d) * 2.4;
      }
    } else if (e.type === "ranger") {
      const s = d > 9 ? 2.1 : d < 6 ? -2.5 : 0;
      mx = (dx / d) * s + (dz / d) * 0.65;
      mz = (dz / d) * s - (dx / d) * 0.65;
      if (e.cool <= 0) {
        e.tell = 0.45;
        e.cool = 2.5;
      }
      if (e.tell > 0) {
        e.tell -= dt;
        if (e.tell <= 0) {
          for (const off of [-0.13, 0, 0.13])
            this.bullet(e.x, e.z, a + off, 9.5, true, 12);
        }
      }
    } else if (e.type === "boss") {
      mx = (dx / d) * (d > 6 ? 1.15 : 0);
      mz = (dz / d) * (d > 6 ? 1.15 : 0);
      if (e.cool <= 0) {
        e.tell = 0.8;
        e.cool = e.hp < e.max / 2 ? 1.8 : 2.5;
      }
      if (e.tell > 0) {
        e.tell -= dt;
        if (e.tell <= 0) {
          for (let i = 0; i < 16; i++)
            this.bullet(
              e.x,
              e.z,
              (i / 16) * Math.PI * 2 + this.elapsed * 0.2,
              7.5,
              true,
              16,
            );
          for (const off of [-0.12, 0, 0.12])
            this.bullet(e.x, e.z, a + off, 11, true, 16);
          this.audio.tone(90, 0.3, "triangle", 0.05);
        }
      }
    } else {
      mx = (dx / d) * (3.1 + this.wave * 0.08);
      mz = (dz / d) * (3.1 + this.wave * 0.08);
    }
    if (e.tell <= 0) {
      e.navTimer -= dt;
      if (e.charge <= 0 && this.lineBlocked(e.x, e.z, this.x, this.z, e.r)) {
        if (e.navTimer <= 0) {
          const point = this.waypoint(e.x, e.z, this.x, this.z, e.r);
          e.nx = point.x;
          e.nz = point.z;
          e.navTimer = 0.45;
        }
        const nd = Math.hypot(e.nx - e.x, e.nz - e.z) || 1;
        const ns = e.type === "boss" ? 1.15 : e.type === "charger" ? 2.4 : 3.1;
        mx = ((e.nx - e.x) / nd) * ns;
        mz = ((e.nz - e.z) / nd) * ns;
      }
      for (const other of this.enemies) {
        if (e === other) continue;
        const sx = e.x - other.x,
          sz = e.z - other.z,
          dist = Math.hypot(sx, sz);
        if (dist > 0 && dist < e.r + other.r + 0.3) {
          mx += (sx / dist) * 1.7;
          mz += (sz / dist) * 1.7;
        }
      }
      this.move(e, mx * dt, mz * dt, e.r);
    }
    const warning = e.mesh.getObjectByName("warning");
    if (warning) warning.visible = e.tell > 0;
    e.mesh.position.set(
      e.x,
      e.tell > 0 ? Math.sin(this.elapsed * 30) * 0.06 : 0,
      e.z,
    );
    e.mesh.rotation.y =
      e.type === "charger" && (e.charge > 0 || e.tell > 0)
        ? Math.atan2(e.dx, e.dz)
        : a;
    e.mesh.scale.setScalar(
      e.flash > 0
        ? 1.12
        : e.tell > 0
          ? 1 + Math.sin(this.elapsed * 22) * 0.04
          : 1,
    );
    if (Math.hypot(this.x - e.x, this.z - e.z) < e.r + 0.47)
      this.hurt(e.type === "charger" ? 24 : e.type === "boss" ? 25 : 12);
  }
  removeBullet(b: Bullet) {
    this.removeMesh(b.mesh);
    const i = this.bullets.indexOf(b);
    if (i >= 0) this.bullets.splice(i, 1);
  }
  update(dt: number) {
    this.elapsed += dt;
    this.waveTime += dt;
    this.shot -= dt;
    this.dash = Math.max(0, this.dash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
    if (this.reload > 0) {
      this.reload -= dt;
      if (this.reload <= 0) {
        this.ammo[this.weapon] = this.capacity();
        this.audio.tone(440, 0.06);
      }
    }
    const aim = this.world.pointer(this.mouse.x, this.mouse.y);
    this.angle = Math.atan2(aim.x - this.x, aim.z - this.z);
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.burst(this.x, this.z, 0x8fe5cb, 2, 1);
    } else {
      let dx =
          Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
          Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")),
        dz =
          Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
          Number(this.keys.has("KeyW") || this.keys.has("ArrowUp"));
      const len = Math.hypot(dx, dz) || 1;
      const ease = 1 - Math.exp(-22 * dt);
      this.vx = T.MathUtils.lerp(this.vx, (dx / len) * 7.2 * this.speed, ease);
      this.vz = T.MathUtils.lerp(this.vz, (dz / len) * 7.2 * this.speed, ease);
    }
    this.move(this, this.vx * dt, this.vz * dt, 0.43);
    this.player.position.set(
      this.x,
      Math.sin(this.elapsed * 18) *
        Math.min(0.045, Math.hypot(this.vx, this.vz) * 0.006),
      this.z,
    );
    this.player.rotation.y = this.angle;
    this.player.visible =
      this.invuln <= 0 || Math.floor(this.elapsed * 24) % 2 === 0;
    if (this.mouse.down) this.shoot();
    this.spawnTimer -= dt;
    if (
      this.wave < 6 &&
      this.waveTime < 55 &&
      this.spawnTimer <= 0 &&
      this.enemies.length + this.spawns.length < 22
    ) {
      const count = this.wave >= 4 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const r = Math.random();
        this.queue(
          this.wave >= 3 && r < 0.22
            ? "charger"
            : this.wave >= 2 && r < 0.48
              ? "ranger"
              : "drone",
        );
      }
      this.spawnTimer = Math.max(0.7, 2.1 - this.wave * 0.2);
    }
    if (this.wave === 6) {
      if (!this.bossSpawned) {
        this.queue("boss");
        this.bossSpawned = true;
      }
      if (this.spawnTimer <= 0 && this.enemies.length < 9) {
        this.queue(Math.random() < 0.5 ? "ranger" : "drone");
        this.spawnTimer = 5;
      }
    }
    for (const s of [...this.spawns]) {
      s.t -= dt;
      s.mesh.scale.setScalar(1 + Math.sin(this.elapsed * 12) * 0.14);
      if (s.t <= 0) {
        this.spawn(s);
        this.removeMesh(s.mesh);
        this.spawns.splice(this.spawns.indexOf(s), 1);
      }
    }
    if (this.wave >= 4) {
      this.hazardTimer -= dt;
      if (this.hazardTimer <= 0) {
        const mesh = ring(2.8, 0xff7551);
        mesh.position.set(this.x, 0.05, this.z);
        this.world.root.add(mesh);
        this.hazards.push({ mesh, x: this.x, z: this.z, t: 2, fired: false });
        this.hazardTimer = this.wave === 6 ? 5 : 8;
      }
    }
    for (const h of [...this.hazards]) {
      h.t -= dt;
      h.mesh.scale.setScalar(1 + Math.sin(this.elapsed * 18) * 0.03);
      if (h.t < 0.45 && !h.fired) {
        h.fired = true;
        this.burst(h.x, h.z, 0xff7844, 28, 8);
        if (Math.hypot(this.x - h.x, this.z - h.z) < 2.8) this.hurt(22);
        this.audio.tone(60, 0.3, "sawtooth", 0.04);
      }
      if (h.t <= 0) {
        this.removeMesh(h.mesh);
        this.hazards.splice(this.hazards.indexOf(h), 1);
      }
    }
    for (const e of [...this.enemies]) {
      this.enemyStep(e, dt);
      if (this.state !== "playing") return;
    }
    for (const b of [...this.bullets]) {
      b.life -= dt;
      const steps = Math.ceil((Math.hypot(b.vx, b.vz) * dt) / 0.28);
      let removed = false;
      for (let j = 0; j < steps; j++) {
        b.x += (b.vx * dt) / steps;
        b.z += (b.vz * dt) / steps;
        if (
          Math.abs(b.x) > 20 ||
          Math.abs(b.z) > 15 ||
          this.blocked(b.x, b.z, 0.07)
        ) {
          this.burst(b.x, b.z, b.enemy ? 0xff8866 : 0xffd197, 2, 2);
          this.removeBullet(b);
          removed = true;
          break;
        }
        if (b.enemy) {
          if (Math.hypot(b.x - this.x, b.z - this.z) < 0.5) {
            this.hurt(b.damage);
            this.removeBullet(b);
            removed = true;
            break;
          }
        } else {
          for (const e of [...this.enemies])
            if (
              !b.hit.has(e) &&
              Math.hypot(b.x - e.x, b.z - e.z) < e.r + 0.13
            ) {
              b.hit.add(e);
              this.hit(e, b.damage);
              if (b.pierce-- <= 0) {
                this.removeBullet(b);
                removed = true;
                break;
              }
            }
          if (removed) break;
        }
      }
      if (!removed) {
        b.mesh.position.set(b.x, 0.72, b.z);
        if (b.life <= 0) this.removeBullet(b);
      }
      if (this.state !== "playing") return;
    }
    for (const p of [...this.pickups]) {
      p.life -= dt;
      const dx = this.x - p.x,
        dz = this.z - p.z,
        d = Math.hypot(dx, dz);
      if (d < (this.upgrades.has("magnet") ? 6 : 2.5)) {
        p.x += dx * dt * 6;
        p.z += dz * dt * 6;
      }
      p.mesh.position.set(p.x, 0.45 + Math.sin(this.elapsed * 4) * 0.12, p.z);
      p.mesh.rotation.y += dt * 2;
      if (d < 0.65) {
        if (p.health) this.hp = Math.min(this.maxHp, this.hp + 18);
        else
          this.energy = Math.min(
            100,
            this.energy + (this.upgrades.has("magnet") ? 10 : 7),
          );
        this.audio.pickup();
        p.life = 0;
      }
      if (p.life <= 0) {
        this.removeMesh(p.mesh);
        this.pickups.splice(this.pickups.indexOf(p), 1);
      }
    }
    if (
      this.wave < 6 &&
      this.waveTime >= 55 &&
      this.enemies.length === 0 &&
      this.spawns.length === 0
    )
      this.upgrade();
  }
  upgrade = upgrade.bind(this);
  finish = finish.bind(this);
  hud = hud.bind(this);
  frame(t: number) {
    const dt = Math.min(0.033, (t - this.last) / 1000 || 0.016);
    this.last = t;
    if (this.state === "playing") this.update(dt);
    for (const p of [...this.particles]) {
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.position.y += p.vy * dt;
      p.vy -= 12 * dt;
      p.mesh.scale.setScalar(Math.max(0, p.life / p.max));
      if (p.life <= 0) {
        this.removeMesh(p.mesh);
        this.particles.splice(this.particles.indexOf(p), 1);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 2);
    this.noticeTime -= this.state === "playing" ? dt : 0;
    $("notice").style.opacity = this.noticeTime > 0 ? "1" : "0";
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2);
    $("damage").style.opacity = String(this.damageFlash);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    ($("crosshair").lastElementChild as HTMLElement).style.opacity =
      this.hitFlash > 0 ? "1" : "0";
    this.hud();
    this.world.render(this.shake);
    requestAnimationFrame((n) => this.frame(n));
  }
}
