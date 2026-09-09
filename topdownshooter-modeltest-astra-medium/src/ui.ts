import type { Game } from "./game";
const $ = (id: string) => document.getElementById(id)!;
export function menu(this: Game) {
  this.state = "menu";
  $("overlay").innerHTML =
    `<div class="menu"><div class="eyebrow">TACTICAL SURVIVAL / 01</div><h1>EMBER<span>RELAY ZERO</span></h1><p>The relay has gone dark. You are the last operator.<br>Break the machine siege. Silence the Warden.</p><button class="primary" id="start">ENTER THE RELAY <span>↗</span></button><div class="controls"><div><b>W A S D</b>MOVE</div><div><b>MOUSE</b>AIM + FIRE</div><div><b>SHIFT</b>DASH</div><div><b>SPACE</b>DISCHARGE</div></div><div class="meta"><strong>SECTOR 00 / QUARANTINED</strong><br>6 ENCOUNTERS · 1 FINAL SIGNAL<br>PERSONAL BEST / ${this.best.toLocaleString()}<br>HEADPHONES RECOMMENDED</div></div>`;
  $("start").onclick = () => this.start();
}
export function resume(this: Game) {
  this.state = "playing";
  $("overlay").innerHTML = "";
  document.body.classList.add("playing");
  $("crosshair").style.display = "block";
  this.mouse.down = false;
}
export function pause(this: Game) {
  this.state = "paused";
  this.mouse.down = false;
  document.body.classList.remove("playing");
  $("crosshair").style.display = "none";
  $("overlay").innerHTML =
    `<div class="panel"><div class="eyebrow">SIGNAL HELD</div><h2>Take a breath.</h2><p>WASD to move · Mouse to aim and fire · Shift to dash<br>1 / 2 to switch weapons · R to reload · Space to discharge<br>Collect amber cells to charge your discharge. Mint cells restore integrity.<br>Cover stops bullets. A dash lets you pass safely through danger.</p><button class="primary" id="resume">RESUME <span>↗</span></button></div>`;
  $("resume").onclick = () => this.resume();
}
export function notice(this: Game, text: string, time = 2.8) {
  $("notice").textContent = text;
  this.noticeTime = time;
}
export function upgrade(this: Game) {
  this.state = "upgrade";
  this.mouse.down = false;
  document.body.classList.remove("playing");
  $("crosshair").style.display = "none";
  this.hp = Math.min(this.maxHp, this.hp + 20);
  this.ammo = [24, 7];
  this.reload = 0;
  for (const b of [...this.bullets]) this.removeBullet(b);
  const options = [
    {
      id: "pierce",
      name: "Rail conversion",
      desc: "Both weapons punch through three targets. Line up the swarm.",
      tag: "BALLISTICS",
    },
    {
      id: "wake",
      name: "Afterburn",
      desc: "Dashing fires a ring of projectiles. Turn your escape into an attack.",
      tag: "MOBILITY",
    },
    {
      id: "volatile",
      name: "Chain reaction",
      desc: "Destroyed machines damage nearby enemies. Fight them in clusters.",
      tag: "DEMOLITION",
    },
    {
      id: "magnet",
      name: "Field harvester",
      desc: "Triple collection reach and stronger energy cells. Discharge more often.",
      tag: "ENERGY",
    },
    {
      id: "rapid",
      name: "Hot chamber",
      desc: "Fire 25% faster with both weapons. Keep the pressure on.",
      tag: "BALLISTICS",
    },
    {
      id: "mobility",
      name: "Ghost protocol",
      desc: "Dash recharges 35% faster. Move 12% faster.",
      tag: "MOBILITY",
    },
    {
      id: "armor",
      name: "Reinforced frame",
      desc: "Gain 30 maximum integrity and fully repair your armor.",
      tag: "SURVIVAL",
    },
  ]
    .filter((o) => !this.upgrades.has(o.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  $("overlay").innerHTML =
    `<div class="panel"><div class="eyebrow">ENCOUNTER ${String(this.wave).padStart(2, "0")} / COMPLETE</div><h2>Adapt. Then advance.</h2><p>Integrity restored +20. Select a permanent field modification.</p><div class="cards">${options.map((o, i) => `<button class="card" id="up${i}"><small>0${i + 1} / ${o.tag}</small><h3>${o.name}</h3><p>${o.desc}</p></button>`).join("")}</div></div>`;
  options.forEach(
    (o, i) =>
      ($("up" + i).onclick = () => {
        this.upgrades.add(o.id);
        if (o.id === "rapid") this.fireRate = 1.25;
        if (o.id === "mobility") {
          this.speed = 1.12;
          this.dashMax = 1.43;
        }
        if (o.id === "armor") {
          this.maxHp += 30;
          this.hp = this.maxHp;
        }
        this.wave++;
        this.waveTime = 0;
        this.spawnTimer = 2;
        this.hazardTimer = 6;
        this.invuln = 1;
        this.audio.pickup();
        this.resume();
        this.notice(
          this.wave === 6
            ? "06 / THE WARDEN"
            : `${String(this.wave).padStart(2, "0")} / ${["", "", "RANGED SIGNALS", "BREAK THE LANCE", "ORBITAL INTERFERENCE", "HOLD THE RELAY"][this.wave]}`,
          3.5,
        );
      }),
  );
}
export function finish(this: Game, win: boolean) {
  this.state = win ? "won" : "dead";
  this.mouse.down = false;
  this.player.visible = true;
  document.body.classList.remove("playing");
  $("crosshair").style.display = "none";
  if (this.score > this.best) {
    this.best = this.score;
    try {
      localStorage.setItem("ember-best", String(this.best));
    } catch {}
  }
  $("overlay").innerHTML =
    `<div class="panel"><div class="eyebrow">${win ? "CONTAINMENT SUCCESSFUL" : "OPERATOR SIGNAL LOST"}</div><h2>${win ? "The relay is yours." : "A signal worth fighting for."}</h2><p>${win ? "Warden neutralized. Ember systems returning online." : "Use cover against ranged fire. Dash through danger. Collect energy and discharge when surrounded."}</p><div class="resultstats"><div><small>FINAL SCORE</small><strong>${this.score.toLocaleString()}</strong></div><div><small>DESTROYED</small><strong>${this.kills}</strong></div><div><small>TIME</small><strong>${Math.floor(this.elapsed / 60)}:${String(Math.floor(this.elapsed % 60)).padStart(2, "0")}</strong></div><div><small>ENCOUNTER</small><strong>${this.wave}/6</strong></div></div><button class="primary" id="restart">${win ? "RUN IT BACK" : "REDEPLOY"} <span>↗</span></button></div>`;
  $("restart").onclick = () => this.start();
  if (win) this.audio.tone(440, 0.7, "sine", 0.1, 880);
}
export function hud(this: Game) {
  $("health").textContent = String(Math.ceil(this.hp));
  $("healthbar").style.width = (this.hp / this.maxHp) * 100 + "%";
  $("healthbar").style.background = this.hp < 30 ? "#f5785b" : "#a6e4c4";
  $("wave").textContent = String(this.wave).padStart(2, "0") + " / 06";
  $("score").textContent = String(this.score).padStart(6, "0");
  $("combo").textContent =
    this.combo >= 4
      ? `CHAIN ${this.combo} / ×${(1 + Math.floor(this.combo / 4) * 0.25).toFixed(2)}`
      : "";
  $("weapon").textContent =
    this.weapon === 0 ? "01 / PULSE RIFLE" : "02 / SCATTERGUN";
  $("ammo").innerHTML = `${this.ammo[this.weapon]} <em>/ ∞</em>`;
  $("reload").textContent = this.reload > 0 ? "RELOADING…" : "";
  $("dashbar").style.width = (1 - this.dash / this.dashMax) * 100 + "%";
  $("energybar").style.width = this.energy + "%";
  $("energybar").style.background = this.energy === 100 ? "#d5ffcb" : "#ef8a51";
  $("progress").style.width = Math.min(100, (this.waveTime / 55) * 100) + "%";
  $("objective").textContent =
    this.wave === 6
      ? "DESTROY THE WARDEN"
      : this.waveTime >= 55
        ? `ELIMINATE ${this.enemies.length + this.spawns.length} HOSTILES`
        : `HOLD THE RELAY / ${Math.ceil(55 - this.waveTime)}s`;
  const boss = this.enemies.find((e) => e.type === "boss");
  $("boss").hidden = !boss;
  if (boss)
    $("bossbar").style.width = Math.max(0, (boss.hp / boss.max) * 100) + "%";
}
