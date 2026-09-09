import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url=process.env.GAME_URL||'http://localhost:5176';
const out=new URL('../.test-artifacts/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  await page.goto(url);await page.waitForFunction(()=>!!window.__LAST_SIGNAL__);
  await page.screenshot({path:new URL('title.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await page.getByRole('button',{name:'FIELD MANUAL'}).click();await page.getByRole('heading',{name:'Keep it alive.'}).waitFor();await page.getByRole('button',{name:'Close panel'}).click();
  await page.getByRole('button',{name:'DEPLOY OPERATOR',exact:false}).click();
  await page.waitForFunction(()=>window.__LAST_SIGNAL__.state==='playing');
  const start=await page.evaluate(()=>({x:window.__LAST_SIGNAL__.player.x,z:window.__LAST_SIGNAL__.player.z}));
  await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');
  const moved=await page.evaluate(()=>window.__LAST_SIGNAL__.player.x);assert.ok(moved>start.x+1,'WASD moves the operator');
  await page.keyboard.press('2');await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.__LAST_SIGNAL__.player.weapon),1);
  await page.keyboard.press('q');await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.__LAST_SIGNAL__.player.weapon),0);
  await page.mouse.move(1100,450);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();assert.ok(await page.evaluate(()=>window.__LAST_SIGNAL__.player.ammo[0]<28),'mouse hold fires rounds');
  await page.keyboard.press('r');await page.waitForTimeout(1800);assert.equal(await page.evaluate(()=>window.__LAST_SIGNAL__.player.ammo[0]),28);
  await page.keyboard.down('s');await page.keyboard.press('Shift');await page.keyboard.up('s');await page.waitForTimeout(120);assert.ok(await page.evaluate(()=>window.__LAST_SIGNAL__.player.dashCharges<2),'dash consumes a charge');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__LAST_SIGNAL__.state==='paused');const frozen=await page.evaluate(()=>window.__LAST_SIGNAL__.elapsed);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.__LAST_SIGNAL__.elapsed),frozen);
  await page.getByRole('button',{name:'RESUME TRANSMISSION'}).click();
  await page.evaluate(()=>{const g=window.__LAST_SIGNAL__;g.audio.enabled=false;g.start();g.input.mouse.down=true;});
  // Play a real-time opening with the same mouse / key input the operator uses.
  for(let step=0;step<90;step++) {
    const target=await page.evaluate(()=>{const g=window.__LAST_SIGNAL__,p=g.player;let e=g.enemies.filter(e=>!e.dead&&e.spawnTime<=0).sort((a,b)=>((a.x-p.x)**2+(a.z-p.z)**2)-((b.x-p.x)**2+(b.z-p.z)**2))[0];return e?g.world.project(e,.65):null;});
    if(target)await page.mouse.move(target.x,target.y);
    if(step===0)await page.mouse.down();
    if(step===10)await page.keyboard.down('d');if(step===25){await page.keyboard.up('d');await page.keyboard.down('w');}if(step===42){await page.keyboard.up('w');await page.keyboard.down('a');}if(step===67){await page.keyboard.up('a');await page.keyboard.down('s');}
    await page.waitForTimeout(150);
  }
  await page.mouse.up();await page.keyboard.up('s');
  const opening=await page.evaluate(()=>({state:window.__LAST_SIGNAL__.state,kills:window.__LAST_SIGNAL__.player.kills,health:window.__LAST_SIGNAL__.player.health,elapsed:window.__LAST_SIGNAL__.elapsed,drawCalls:window.__LAST_SIGNAL__.world.renderer.info.render.calls,geometries:window.__LAST_SIGNAL__.world.renderer.info.memory.geometries}));
  assert.ok(opening.kills>=2,`shooting hits moving enemies (${JSON.stringify(opening)})`);assert.equal(opening.state,'playing');
  await page.screenshot({path:new URL('combat.png',out).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
  await page.keyboard.press('Escape');
  // Edge-case fixtures use the public game systems, at normal physics timesteps.
  const edgeCases=await page.evaluate(()=>{
    const g=window.__LAST_SIGNAL__,checks=[];g.audio.enabled=false;g.start();
    g.player.energy=100;g.spawnEnemy('crawler',{x:g.player.x+3,z:g.player.z});const e=g.enemies.at(-1);e.spawnTime=0;g.discharge();checks.push(['discharge-kill',e.dead]);checks.push(['discharge-cost',g.player.energy===0]);
    g.start();g.player.invulnerable=0;g.player.health=1;g.bullets.add({x:g.player.x-1,z:g.player.z},{x:1,z:0},49,10,false);g.updateGame(1/30);checks.push(['projectile-death',g.state==='ended']);
    g.start();checks.push(['clean-restart',g.player.health===100&&g.enemies.length===0&&g.bullets.items.length===0&&g.owned.size===0&&g.wave===1]);
    g.waveTime=45.1;for(let i=0;i<100;i++)g.updateGame(1/60);checks.push(['upgrade-flow',g.state==='upgrade'&&g.choices.length===3]);const id=g.choices[0].id;g.selectUpgrade(id);checks.push(['upgrade-apply',g.state==='playing'&&g.wave===2&&g.owned.has(id)]);
    g.start();g.wave=7;g.spawnEnemy('boss',{x:0,z:-10});const boss=g.enemies.at(-1);boss.spawnTime=0;g.damageEnemy(boss,3000,g.player);g.updateGame(1/60);checks.push(['victory',g.state==='ended'&&document.querySelector('#end-title').textContent==='Signal restored.']);
    g.start();checks.push(['victory-restart',g.state==='playing'&&g.wave===1&&!g.player.build.drone]);g.pause();return checks;
  });
  for(const [name,ok] of edgeCases)assert.ok(ok,name);
  assert.deepEqual(errors,[],'browser has no runtime errors');
  const result={opening,edgeCases,errors};await writeFile(new URL('browser-results.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
