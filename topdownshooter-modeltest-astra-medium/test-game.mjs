import { chromium } from "@playwright/test";
const browser = await chromium
  .launch({ headless: true })
  .catch(() => chromium.launch({ headless: true, channel: "msedge" }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5188");
await page.screenshot({ path: ".test-artifacts/menu.png" });
await page.click("#start");
await page.keyboard.down("KeyD");
await page.waitForTimeout(700);
await page.keyboard.up("KeyD");
const moved = await page.evaluate(() => window.game.x);
if (moved < 2) throw Error("Movement failed");
await page.mouse.move(720, 300);
await page.mouse.down();
await page.waitForTimeout(4500);
await page.mouse.up();
await page.screenshot({ path: ".test-artifacts/gameplay.png" });
console.log(
  "movement",
  moved,
  "combat",
  await page.evaluate(() => ({
    ammo: game.ammo,
    enemies: game.enemies.length,
    kills: game.kills,
    angle: game.angle,
  })),
);
await page.keyboard.press("Shift");
console.log("dash", await page.evaluate(() => game.dash));
await page.keyboard.press("Escape");
if ((await page.evaluate(() => game.state)) !== "paused")
  throw Error("Pause failed");
await page.click("#resume");
await page.evaluate(() => {
  game.invuln = 0;
  game.hurt(35);
});
if ((await page.evaluate(() => game.hp)) !== 65) throw Error("Damage failed");
await page.evaluate(() => {
  game.clear();
  game.waveTime = 56;
});
await page.waitForTimeout(100);
if ((await page.evaluate(() => game.state)) !== "upgrade")
  throw Error("Progression failed");
await page.click("#up0");
if ((await page.evaluate(() => game.wave)) !== 2) throw Error("Upgrade failed");
await page.evaluate(() => {
  game.invuln = 0;
  game.hurt(200);
});
if ((await page.evaluate(() => game.state)) !== "dead")
  throw Error("Death failed");
await page.click("#restart");
if ((await page.evaluate(() => game.hp)) !== 100) throw Error("Restart failed");
await page.evaluate(() => {
  game.clear();
  game.wave = 6;
  game.bossSpawned = false;
});
await page.waitForTimeout(1600);
if (!(await page.evaluate(() => game.enemies.some((e) => e.type === "boss"))))
  throw Error("Boss failed");
await page.evaluate(() => {
  game.hit(
    game.enemies.find((e) => e.type === "boss"),
    3000,
  );
});
if ((await page.evaluate(() => game.state)) !== "won")
  throw Error("Victory failed");
await page.click("#restart");
console.log("All flow checks passed. Console errors:", errors);
await browser.close();
if (errors.length) process.exitCode = 1;
