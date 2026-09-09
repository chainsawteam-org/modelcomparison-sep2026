import { chromium } from "@playwright/test";
const browser = await chromium
  .launch({ headless: true })
  .catch(() => chromium.launch({ headless: true, channel: "msedge" }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:5188");
await page.click("#start");
const result = await page.evaluate(() => {
  const g = window.game;
  g.audio.enabled = false;
  g.clear();
  g.spawnTimer = 999;
  g.x = 0;
  g.z = 3;
  g.spawn({ x: 0, z: -5, type: "drone" });
  const e = g.enemies[0],
    pos = e.mesh.position.clone();
  pos.y = 0.72;
  pos.project(g.world.camera);
  g.mouse.x = ((pos.x + 1) * innerWidth) / 2;
  g.mouse.y = ((1 - pos.y) * innerHeight) / 2;
  g.mouse.down = true;
  for (let i = 0; i < 90; i++) g.update(1 / 60);
  g.mouse.down = false;
  const aimKills = g.kills;
  g.clear();
  g.x = 0;
  g.z = 3;
  g.spawn({ x: 0, z: -6, type: "charger" });
  const charger = g.enemies[0];
  charger.cool = 0;
  for (let i = 0; i < 52; i++) g.update(1 / 60);
  const chargeStart = charger.z;
  for (let i = 0; i < 20; i++) g.update(1 / 60);
  const chargeDistance = charger.z - chargeStart;
  g.clear();
  g.x = -9;
  g.z = -1;
  g.invuln = 100;
  g.spawn({ x: -9, z: -9, type: "drone" });
  const drone = g.enemies[0];
  for (let i = 0; i < 600; i++) g.update(1 / 60);
  const navigationDistance = Math.hypot(drone.x - g.x, drone.z - g.z);
  g.clear();
  g.energy = 100;
  g.spawn({ x: g.x + 2, z: g.z, type: "drone" });
  g.discharge();
  const discharged = g.energy === 0 && g.enemies.length === 0;
  return { aimKills, chargeDistance, navigationDistance, discharged };
});
console.log(result);
if (
  result.aimKills !== 1 ||
  result.chargeDistance < 4 ||
  result.navigationDistance > 2 ||
  !result.discharged
)
  throw Error("Combat verification failed");
await page.evaluate(() => {
  game.start();
  game.wave = 5;
  game.invuln = 200;
  game.audio.enabled = false;
});
for (let i = 0; i < 100; i++) {
  await page.evaluate(() => {
    const g = game;
    g.keys.clear();
    const phase = Math.floor(g.elapsed / 3) % 4;
    g.keys.add(["KeyD", "KeyW", "KeyA", "KeyS"][phase]);
    const e = [...g.enemies].sort(
      (a, b) =>
        Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z),
    )[0];
    if (e) {
      const p = e.mesh.position.clone();
      p.y = 0.72;
      p.project(g.world.camera);
      g.mouse.x = ((p.x + 1) * innerWidth) / 2;
      g.mouse.y = ((1 - p.y) * innerHeight) / 2;
      g.mouse.down = true;
    }
    if (g.energy >= 100) g.discharge();
    for (let n = 0; n < 12; n++) if (g.state === "playing") g.update(1 / 60);
  });
  await page.waitForTimeout(20);
}
await page.screenshot({ path: ".test-artifacts/combat.png" });
console.log(
  "Sustained combat:",
  await page.evaluate(() => ({
    kills: game.kills,
    enemies: game.enemies.length,
    bullets: game.bullets.length,
    geometries: game.world.renderer.info.memory.geometries,
  })),
);
await browser.close();
