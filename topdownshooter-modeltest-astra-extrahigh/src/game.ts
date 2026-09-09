import * as THREE from 'three';
import { World } from './world';
import { Input } from './input';
import { AudioSystem } from './audio';
import { Effects } from './effects';
import { Player, Enemy, Bullets, makePickup, type Pickup, type Barrel, type Hazard } from './entities';
import { COLORS, box, cylinder, mat, enemyColors, type EnemyKind } from './models';
import { Navigation, clamp, clearLine, dist2, moveCircle, normalize, rand, segmentCircle, type Point } from './math';
import { UPGRADES, chooseUpgrades, WAVE_DURATION, WAVE_HINTS, WAVE_NAMES, type Upgrade } from './progression';
import { updateEnemy, type EnemyContext } from './enemy-ai';
import { UI, readSave, writeSave, type UIAction } from './ui';

type State='menu'|'playing'|'paused'|'upgrade'|'ended';
interface Preferences {enabled:boolean;music:boolean;quality:boolean;motion:boolean;assist:boolean;volume:number}
export class Game {
  world:World;input:Input;audio=new AudioSystem();effects:Effects;ui:UI;player=new Player();nav:Navigation;bullets:Bullets;
  state:State='menu';enemies:Enemy[]=[];pickups:Pickup[]=[];barrels:Barrel[]=[];hazards:Hazard[]=[];
  wave=1;waveTime=0;elapsed=0;score=0;best=0;streak=0;combo=1;comboTimer=0;owned=new Set<string>();choices:Upgrade[]=[];
  aim:Point={x:4,z:0};preferences:Preferences;runAssist=false;
  private spawnClock=0;private navClock=0;private hazardClock=9;private intermission=0;private hudClock=0;
  private hitStop=0;private time=0;private last=0;private bossSpawned=false;private lastHealingKill=0;
  private enemyContext:EnemyContext;private drone:THREE.Group;private droneClock=0;private pendingVictory=false;
  constructor(host:HTMLElement) {
    this.world=new World(host);this.ui=new UI(host);this.input=new Input(this.world.renderer.domElement);this.effects=new Effects(this.world.scene);this.nav=new Navigation(this.world.obstacles);this.bullets=new Bullets(this.world.scene);
    this.preferences=readSave<Preferences>('preferences',{enabled:true,music:true,quality:true,motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,assist:false,volume:.5});
    // A corrupt or old save should never prevent a fresh session.
    this.preferences={enabled:true,music:true,quality:true,motion:true,assist:false,volume:.5,...(typeof this.preferences==='object'?this.preferences:{})};this.preferences.volume=clamp(Number(this.preferences.volume)||0,0,1);
    this.loadBest();this.applySettings();this.ui.show('menu');
    this.world.scene.add(this.player.model.group);this.player.model.group.position.set(3,0,5);this.player.model.body.rotation.y=.8;
    this.drone=new THREE.Group();cylinder(this.drone,.25,.32,.2,0,0,0,mat(0xb0c8b9),6);box(this.drone,.12,.08,.3,0,.1,.2,mat(COLORS.teal,1));this.drone.visible=false;this.world.scene.add(this.drone);
    this.enemyContext={player:this.player,enemies:this.enemies,world:this.world,nav:this.nav,bullets:this.bullets,audio:this.audio,effects:this.effects,damagePlayer:n=>this.damagePlayer(n),hazard:(p,r,t)=>this.spawnHazard(p,r,t),summon:p=>this.spawnEnemy('swarm',p),notice:text=>this.ui.notice(text)};
    this.ui.onAction=action=>this.action(action);this.ui.onUpgrade=id=>this.selectUpgrade(id);this.ui.onVolume=v=>{this.preferences.volume=v;this.applySettings();};
    this.input.onPause=()=>{if(this.state==='playing')this.pause();};
    this.world.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(this.state==='playing')this.pause();this.ui.notice('GRAPHICS CONTEXT LOST — RELOAD TO RECONNECT');});
    this.resetBarrels();requestAnimationFrame(t=>this.frame(t));
  }
  private loadBest():void {this.best=Number(readSave(this.preferences.assist?'best-assist':'best',0))||0;this.ui.setBest(this.best);}
  private applySettings():void {this.audio.enabled=this.preferences.enabled;this.audio.music=this.preferences.music;this.audio.setVolume(this.preferences.volume);this.world.motion=this.preferences.motion;if(this.world.quality!==this.preferences.quality)this.world.setQuality(this.preferences.quality);this.ui.settings(this.preferences);writeSave('preferences',this.preferences);}
  action(action:UIAction):void {
    this.audio.unlock();
    if(action==='start'||action==='restart'){this.start();return;}
    if(action==='resume'){if(this.state==='paused'){this.state='playing';this.input.clear();this.ui.closePanel();this.ui.show('playing');this.audio.ui();}return;}
    if(action==='pause'){this.pause();return;}
    if(action==='menu'){this.clearRun();this.state='menu';this.ui.show('menu');this.ui.closePanel();this.loadBest();this.resetBarrels();this.player.reset();this.player.model.group.position.set(3,0,5);return;}
    if(action==='mute')this.preferences.enabled=!this.preferences.enabled;
    else if(action==='assist') {if(this.state==='paused'){this.ui.notice('ASSIST CHANGES APPLY TO YOUR NEXT RUN');}this.preferences.assist=!this.preferences.assist;this.loadBest();}
    else this.preferences[action]=!this.preferences[action];
    this.applySettings();this.audio.ui();
  }
  pause():void {if(this.state!=='playing')return;this.state='paused';this.input.clear();this.ui.show('pause');}
  start():void {
    this.clearRun();this.player.reset();this.wave=1;this.waveTime=0;this.elapsed=0;this.score=0;this.streak=0;this.combo=1;this.comboTimer=0;this.owned.clear();this.choices=[];this.lastHealingKill=0;this.runAssist=this.preferences.assist;
    this.best=Number(readSave(this.runAssist?'best-assist':'best',0))||0;this.state='playing';this.input.clear();this.ui.closePanel();this.ui.show('playing');this.resetBarrels();this.nav.update(this.player);this.beginWave();this.updateHUD();this.audio.unlock();
  }
  private clearRun():void {
    for(const e of this.enemies)e.dispose(this.world.scene);this.enemies.length=0;
    for(const p of this.pickups)this.world.scene.remove(p.mesh);this.pickups=[];
    this.bullets.clear();this.clearHazards();this.effects.clear();this.drone.visible=false;this.droneClock=0;this.pendingVictory=false;this.hitStop=0;this.intermission=0;this.world.shake=0;
  }
  private clearHazards():void {for(const h of this.hazards){this.world.scene.remove(h.mesh);h.mesh.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});}this.hazards=[];}
  private resetBarrels():void {
    for(const b of this.barrels){this.world.scene.remove(b.mesh);b.mesh.traverse(o=>{if(o instanceof THREE.Mesh && o.geometry.type==='CylinderGeometry')o.geometry.dispose();});}this.barrels=[];
    for(const [x,z] of [[-13,-8],[13,8],[-14,4],[14,-4],[-4,-10],[5,11]]) {
      const mesh=new THREE.Group();mesh.position.set(x,0,z);cylinder(mesh,.42,.45,.8,0,.45,0,mat(0x675846),8);cylinder(mesh,.46,.46,.09,0,.84,0,mat(COLORS.amber,.4),8);cylinder(mesh,.46,.46,.08,0,.1,0,mat(0x283b40),8);box(mesh,.22,.35,.03,0,.5,.43,mat(COLORS.amber,1));this.world.scene.add(mesh);this.barrels.push({x,z,mesh,hp:20,alive:true});
    }
  }
  private beginWave():void {
    this.waveTime=0;this.spawnClock=this.wave===1?2:1;this.hazardClock=8;this.intermission=0;this.bossSpawned=false;this.player.invulnerable=Math.max(this.player.invulnerable,1.5);this.player.ammo=[28,6];this.player.reload=0;this.player.energy=Math.min(100,this.player.energy+10);
    this.ui.banner(`ENCOUNTER ${String(this.wave).padStart(2,'0')} / 07`,WAVE_NAMES[this.wave-1],WAVE_HINTS[this.wave-1],this.wave===1?5:4);this.audio.wave();
    if(this.wave===7){this.bossSpawned=true;this.spawnEnemy('boss',{x:0,z:-10});}
  }
  private chooseEnemy():EnemyKind {
    const r=Math.random();
    if(this.wave===1)return 'crawler';
    if(this.wave===2)return r<.34?'gunner':'crawler';
    if(this.wave===3)return r<.23?'charger':r<.51?'gunner':'crawler';
    if(this.wave===4)return r<.31?'swarm':r<.46?'charger':r<.68?'gunner':'crawler';
    return r<.27?'swarm':r<.49?'charger':r<.72?'gunner':'crawler';
  }
  spawnEnemy(kind:EnemyKind,location?:Point):void {
    if(this.enemies.length>=36)return;
    let pos=location;
    if(!pos){
      // Spawn at visible perimeter gates, choosing a gate away from the operator.
      const gates=[{x:rand(-4,4),z:-13.7},{x:18.7,z:rand(-4,4)},{x:rand(-4,4),z:13.7},{x:-18.7,z:rand(-4,4)}].filter(p=>dist2(p,this.player)>64);
      pos=gates[Math.floor(Math.random()*gates.length)]||{x:0,z:-13.7};
    }
    const e=new Enemy(kind,pos,this.wave);moveCircle(e,0,0,e.r,this.world.obstacles);this.enemies.push(e);this.world.scene.add(e.model.group);this.effects.ring(e,enemyColors[kind],e.r+1,1.1);
  }
  private shoot():void {
    const p=this.player,scatter=p.weapon===1;
    if(p.reload>0||p.fireTimer>0)return;
    if(p.ammo[p.weapon]<=0){this.reload();return;}
    const aim=normalize(this.aim.x-p.x,this.aim.z-p.z);if(!aim.x&&!aim.z)return;
    p.angle=Math.atan2(aim.x,aim.z);
    const side={x:aim.z,z:-aim.x};let muzzle={x:p.x+aim.x*1.05+side.x*.37,z:p.z+aim.z*1.05+side.z*.37};
    // Never spawn a shot on the other side of cover if the gun overlaps it.
    if(!clearLine(p,muzzle,this.world.obstacles,.06))muzzle={x:p.x,z:p.z};
    const pellets=scatter?7:1;
    for(let i=0;i<pellets;i++) {const spread=scatter?(i-3)*.075+rand(-.017,.017):rand(-.013,.013),a=p.angle+spread;this.bullets.add(muzzle,{x:Math.sin(a),z:Math.cos(a)},scatter?36:49,(scatter?12:19)*p.build.damage,true,scatter?.36:1.0,p.build.pierce,p.build.ricochet?1:0);}
    p.ammo[p.weapon]--;p.fireTimer=(scatter?.59:.115)/p.build.fireRate;p.recoil=scatter?.18:.085;p.model.flash.visible=true;
    this.effects.burst(muzzle,COLORS.lime,scatter?7:3,1,.8);this.audio.shoot(scatter);if(scatter)this.world.shake=Math.max(this.world.shake,.14);
    if(p.ammo[p.weapon]===0)this.reload();
  }
  reload():void {const p=this.player,capacity=p.weapon===0?28:6;if(p.reload>0||p.ammo[p.weapon]===capacity)return;p.reloadTotal=(p.weapon===0?1.4:1.75)/(p.build.fireRate>1?1.25:1);p.reload=p.reloadTotal;this.audio.reload();}
  private switchWeapon(index:number):void {if(this.player.weapon===index)return;this.player.weapon=index;this.player.reload=0;this.player.fireTimer=Math.max(this.player.fireTimer,.18);this.audio.ui();}
  private dash():void {
    const p=this.player;if(p.dashTime>0)return;if(p.dashCharges<1){this.ui.notice('PHASE DASH RECHARGING');return;}
    const x=+this.input.keys.has('KeyD')-+this.input.keys.has('KeyA'),z=+this.input.keys.has('KeyS')-+this.input.keys.has('KeyW');
    p.dashDir=x||z?normalize(x,z):normalize(this.aim.x-p.x,this.aim.z-p.z);p.dashTime=.19;p.dashCharges--;p.invulnerable=Math.max(p.invulnerable,.32);p.dashHits.clear();this.audio.dash();this.effects.ring(p,COLORS.teal,1.1,.3);
  }
  discharge():void {
    const p=this.player,cost=p.build.capacitor?70:100;if(p.energy<cost){this.ui.notice(`DISCHARGE NEEDS ${cost} ENERGY — COLLECT FRAGMENTS`);return;}
    p.energy-=cost;p.invulnerable=Math.max(p.invulnerable,.65);if(p.build.capacitor)p.health=Math.min(p.build.maxHealth,p.health+12);
    this.effects.ring(p,COLORS.lime,8,.6);this.effects.ring(p,COLORS.teal,7.6,.85);this.effects.burst(p,COLORS.lime,65,12);this.world.shake=.9;this.audio.pulse();
    for(const e of this.enemies){if(!e.dead&&e.spawnTime<=0&&dist2(e,p)<(8+e.r)**2){this.damageEnemy(e,110,p,7);e.stun=1.1;}}
    for(let i=this.bullets.items.length-1;i>=0;i--)if(!this.bullets.items[i].friendly&&dist2(this.bullets.items[i],p)<100)this.bullets.remove(i);
    for(const h of this.hazards)if(dist2(h,p)<64)h.timer=0,h.triggered=true;
    this.ui.notice('DISCHARGE — PROJECTILES CLEARED');
  }
  damagePlayer(damage:number):void {
    const p=this.player;if(this.state!=='playing'||p.invulnerable>0)return;
    p.health=Math.max(0,p.health-damage*(this.runAssist?.65:1));p.invulnerable=.75;p.hurt=.4;this.combo=1;this.streak=0;this.comboTimer=0;
    this.world.shake=Math.max(this.world.shake,.7);this.audio.hurt();this.ui.hurt();this.effects.burst(p,COLORS.ivory,14,4);
    if(p.health<=0)this.finish(false);
  }
  damageEnemy(e:Enemy,damage:number,source:Point,force=2):void {
    if(e.dead||e.spawnTime>0)return;e.hp-=damage;e.flash=.11;
    if(this.player.build.frost)e.slow=1.5;
    const dir=normalize(e.x-source.x,e.z-source.z);e.knock={x:dir.x*force,z:dir.z*force};if(e.kind==='boss'){e.knock.x*=.15;e.knock.z*=.15;}
    this.effects.burst(e,this.player.build.frost?COLORS.teal:COLORS.ivory,3,2);this.ui.hitMarker();
    if(e.hp<=0)this.killEnemy(e);else this.audio.hit();
  }
  private killEnemy(e:Enemy):void {
    if(e.dead)return;e.dead=true;e.tell.visible=false;this.player.kills++;this.streak++;this.comboTimer=3.2;this.combo=Math.min(4,1+Math.floor(this.streak/5)*.5);
    const earned=Math.round(e.score*this.combo);this.score+=earned;const pos=this.world.project(e,1.4);this.ui.floater(`+${earned}`,pos.x,pos.y, '#d6fa89');
    const big=e.kind==='boss'||e.kind==='charger';this.effects.burst(e,enemyColors[e.kind],big?35:19,big?7:4.5);this.effects.burst(e,0xb3bcab,big?14:6,4);this.effects.ring(e,enemyColors[e.kind],big?2:1,.25);this.audio.kill(big);this.world.shake=Math.max(this.world.shake,big?.3:.09);this.hitStop=Math.max(this.hitStop,big?.035:.012);
    const count=e.kind==='charger'?4:e.kind==='gunner'?3:e.kind==='swarm'?1:2;
    for(let i=0;i<count;i++)this.drop({x:e.x+rand(-.5,.5),z:e.z+rand(-.5,.5)},'energy',e.kind==='swarm'?5:6);
    if(this.player.health<this.player.build.maxHealth&&(Math.random()<.11||this.player.kills-this.lastHealingKill>=11)){this.drop(e,'health',16);this.lastHealingKill=this.player.kills;}
    if(this.player.build.leech&&this.player.kills%6===0)this.player.health=Math.min(this.player.build.maxHealth,this.player.health+5);
    if(this.player.build.blast){this.effects.ring(e,COLORS.amber,2.8,.3);for(const other of this.enemies)if(!other.dead&&dist2(other,e)<2.8**2)this.damageEnemy(other,23,e,4);}
    if(e.kind==='boss')this.pendingVictory=true;
  }
  private drop(p:Point,type:Pickup['type'],value:number):void {if(this.pickups.length>=180){const old=this.pickups.shift()!;this.world.scene.remove(old.mesh);}const pickup=makePickup(p,type,value);this.pickups.push(pickup);this.world.scene.add(pickup.mesh);}
  private explodeBarrel(barrel:Barrel):void {
    if(!barrel.alive)return;barrel.alive=false;barrel.mesh.visible=false;this.effects.burst(barrel,COLORS.amber,40,8);this.effects.ring(barrel,COLORS.amber,4,.4);this.audio.kill(true);this.world.shake=.5;
    for(const e of this.enemies)if(!e.dead&&dist2(e,barrel)<(4+e.r)**2)this.damageEnemy(e,130,barrel,9);
    // Canisters are operator-safe: their role is tactical target prioritization.
    for(const other of this.barrels)if(other!==barrel&&other.alive&&dist2(other,barrel)<16)this.explodeBarrel(other);
  }
  spawnHazard(p:Point,radius:number,timer:number):void {
    if(this.hazards.length>=14)return;
    const mesh=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({color:COLORS.red,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(clamp(p.x,-19,19),.035,clamp(p.z,-14,14));mesh.scale.setScalar(radius);
    const outline=new THREE.Mesh(new THREE.RingGeometry(.98,1,48),new THREE.MeshBasicMaterial({color:COLORS.red,transparent:true,opacity:.8,depthWrite:false}));outline.position.z=.004;mesh.add(outline);
    this.world.scene.add(mesh);this.hazards.push({x:mesh.position.x,z:mesh.position.z,mesh,timer,radius,triggered:false,owner:'enemy'});
  }
  private updateHazards(dt:number):void {
    for(let i=this.hazards.length-1;i>=0;i--){const h=this.hazards[i];h.timer-=dt;
      (h.mesh.material as THREE.MeshBasicMaterial).opacity=.08+(.5+.5*Math.sin(h.timer*12))*.14;
      if(h.timer<=0){if(!h.triggered){h.triggered=true;this.effects.ring(h,COLORS.red,h.radius,.3);this.effects.burst(h,COLORS.red,28,7);this.audio.kill(true);if(dist2(h,this.player)<(h.radius+.3)**2)this.damagePlayer(24);}
        this.world.scene.remove(h.mesh);h.mesh.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}});this.hazards.splice(i,1);
      }
    }
  }
  private updatePlayer(dt:number):void {
    const p=this.player,keys=this.input.keys;
    if(this.input.consume('Digit1'))this.switchWeapon(0);if(this.input.consume('Digit2'))this.switchWeapon(1);if(this.input.consume('KeyQ'))this.switchWeapon(1-p.weapon);
    if(this.input.consume('KeyR'))this.reload();if(this.input.consume('ShiftLeft')||this.input.consume('ShiftRight'))this.dash();if(this.input.consume('Space'))this.discharge();
    p.invulnerable=Math.max(0,p.invulnerable-dt);p.hurt=Math.max(0,p.hurt-dt);p.fireTimer=Math.max(0,p.fireTimer-dt);p.recoil=Math.max(0,p.recoil-dt*1.5);
    if(p.dashCharges<2){p.dashRecharge+=dt;const duration=p.build.quickDash?1.56:2.4;if(p.dashRecharge>=duration){p.dashRecharge-=duration;p.dashCharges++;}}else p.dashRecharge=0;
    if(p.reload>0){p.reload-=dt;if(p.reload<=0){p.reload=0;p.ammo[p.weapon]=p.weapon===0?28:6;this.audio.reload(true);}}
    const mx=+(keys.has('KeyD')||keys.has('ArrowRight'))-+(keys.has('KeyA')||keys.has('ArrowLeft')),mz=+(keys.has('KeyS')||keys.has('ArrowDown'))-+(keys.has('KeyW')||keys.has('ArrowUp'));
    const direction=normalize(mx,mz),speed=6.7*p.build.speed,accel=1-Math.exp(-dt*24);p.vx+=(direction.x*speed-p.vx)*accel;p.vz+=(direction.z*speed-p.vz)*accel;
    if(p.dashTime>0){p.dashTime-=dt;moveCircle(p,p.dashDir.x*25*dt,p.dashDir.z*25*dt,.43,this.world.obstacles);this.effects.trail(p,COLORS.teal);
      if(p.build.dashDamage)for(const e of this.enemies)if(!e.dead&&!p.dashHits.has(e.id)&&dist2(e,p)<(e.r+1.1)**2){p.dashHits.add(e.id);this.damageEnemy(e,65,p,6);}
    }else moveCircle(p,p.vx*dt,p.vz*dt,.43,this.world.obstacles);
    p.angle=Math.atan2(this.aim.x-p.x,this.aim.z-p.z);p.model.group.position.set(p.x,0,p.z);p.model.body.rotation.y=p.angle;
    p.walk+=dt*Math.hypot(p.vx,p.vz)*2;p.model.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(p.walk+i*Math.PI)*Math.min(.65,Math.hypot(p.vx,p.vz)*.12);});
    p.model.body.position.y=Math.abs(Math.sin(p.walk))*.035;p.model.gun.position.z=.33-p.recoil;p.model.flash.visible=p.recoil>.035;p.model.group.visible=p.hurt<=0||Math.floor(p.hurt*25)%2===0;
    if(this.input.mouse.down)this.shoot();
  }
  private updateBullets(dt:number):void {
    for(let i=this.bullets.items.length-1;i>=0;i--) {
      const b=this.bullets.items[i];b.life-=dt;if(b.life<=0){this.bullets.remove(i);continue;}
      const from={x:b.x,z:b.z},to={x:b.x+b.vx*dt,z:b.z+b.vz*dt};
      const hits:{t:number;type:'wall'|'enemy'|'player'|'barrel';target?:Enemy|Barrel;normal?:Point}[]=[];
      for(const o of this.world.obstacles){const t=segmentCircle(from,to,o,o.r+b.r*.4);if(t!==null){const x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;hits.push({t,type:'wall',normal:normalize(x-o.x,z-o.z)});}}
      for(const barrel of this.barrels)if(barrel.alive){const t=segmentCircle(from,to,barrel,.47);if(t!==null)hits.push({t,type:'barrel',target:barrel});}
      if(b.friendly){for(const e of this.enemies){if(e.dead||e.spawnTime>0||b.hit.has(e.id))continue;const t=segmentCircle(from,to,e,e.r+b.r);if(t!==null)hits.push({t,type:'enemy',target:e});}}
      else {const t=segmentCircle(from,to,this.player,.42+b.r);if(t!==null)hits.push({t,type:'player'});}
      if(to.x<-20||to.x>20){const boundary=to.x>0?20:-20;hits.push({t:clamp((boundary-from.x)/(to.x-from.x),0,1),type:'wall',normal:{x:to.x>0?-1:1,z:0}});}
      if(to.z<-15||to.z>15){const boundary=to.z>0?15:-15;hits.push({t:clamp((boundary-from.z)/(to.z-from.z),0,1),type:'wall',normal:{x:0,z:to.z>0?-1:1}});}
      hits.sort((a,c)=>a.t-c.t);let removed=false,bounced=false;
      for(const hit of hits) {
        b.x=from.x+(to.x-from.x)*hit.t;b.z=from.z+(to.z-from.z)*hit.t;
        if(hit.type==='enemy'){const e=hit.target as Enemy;if(e.dead)continue;b.hit.add(e.id);this.damageEnemy(e,b.damage,from,b.drone?1:this.player.weapon===1?3:1.5);if(b.pierce>0){b.pierce--;continue;}}
        if(hit.type==='player'){this.damagePlayer(b.damage);if(this.state!=='playing')return;}
        if(hit.type==='barrel'){const barrel=hit.target as Barrel;barrel.hp-=b.damage;if(barrel.hp<=0)this.explodeBarrel(barrel);this.effects.burst(b,COLORS.amber,5,2);}
        if(hit.type==='wall'){
          this.effects.burst(b,b.friendly?COLORS.lime:COLORS.red,3,2);
          if(b.bounce>0&&hit.normal){const n=hit.normal,dot=b.vx*n.x+b.vz*n.z;b.vx-=2*dot*n.x;b.vz-=2*dot*n.z;b.x+=n.x*.05;b.z+=n.z*.05;b.bounce--;b.mesh.rotation.y=Math.atan2(b.vx,b.vz);bounced=true;break;}
        }
        this.bullets.remove(i);removed=true;break;
      }
      if(!removed){if(!bounced){b.x=to.x;b.z=to.z;}b.mesh.position.set(b.x,.7,b.z);}
    }
  }
  private updatePickups(dt:number):void {
    const p=this.player;
    for(let i=this.pickups.length-1;i>=0;i--){const item=this.pickups[i];item.life-=dt;item.age+=dt;const d=Math.sqrt(dist2(item,p));
      if(d<(item.type==='energy'?p.build.magnet:2.1)&&(item.type==='energy'||p.health<p.build.maxHealth)){const dir=normalize(p.x-item.x,p.z-item.z);const speed=Math.min(d/dt,6+(item.age%1)*4+(p.build.magnet-d)*2);item.x+=dir.x*speed*dt;item.z+=dir.z*speed*dt;}
      if(d<.65&&(item.type==='energy'||p.health<p.build.maxHealth)) {if(item.type==='energy'){p.energy=Math.min(100,p.energy+item.value);this.score+=10;}else{p.health=Math.min(p.build.maxHealth,p.health+item.value);const at=this.world.project(p,2);this.ui.floater(`+${item.value} INTEGRITY`,at.x,at.y,'#79e5d5');}this.audio.pickup();this.world.scene.remove(item.mesh);this.pickups.splice(i,1);continue;}
      if(item.life<=0){this.world.scene.remove(item.mesh);this.pickups.splice(i,1);continue;}
      item.mesh.position.set(item.x,.35+Math.sin(item.age*4)*.1,item.z);item.mesh.rotation.y=item.age*2;item.mesh.visible=item.life>4||Math.sin(item.age*16)>0;
    }
  }
  private updateDrone(dt:number):void {
    this.drone.visible=this.player.build.drone;if(!this.drone.visible)return;
    const p=this.player;this.drone.position.set(p.x+Math.cos(this.elapsed*1.8)*1.5,1.5,p.z+Math.sin(this.elapsed*1.8)*1.5);this.droneClock-=dt;
    if(this.droneClock<=0){let target:Enemy|undefined,closest=15**2;for(const e of this.enemies){const d=dist2(e,p);if(!e.dead&&e.spawnTime<=0&&d<closest&&clearLine(this.drone.position,e,this.world.obstacles,.1)){target=e;closest=d;}}
      if(target){const dir=normalize(target.x-this.drone.position.x,target.z-this.drone.position.z);this.drone.rotation.y=Math.atan2(dir.x,dir.z);this.bullets.add(this.drone.position,dir,35,14*this.player.build.damage,true,1,0,0,true);this.droneClock=.48;}
    }
  }
  updateGame(dt:number):void {
    if(this.state!=='playing')return;
    this.elapsed+=dt;this.waveTime+=dt;this.navClock-=dt;this.comboTimer-=dt;if(this.comboTimer<=0){this.streak=0;this.combo=1;}
    this.updatePlayer(dt);if(this.state!=='playing')return;
    if(this.navClock<=0){this.nav.update(this.player);this.navClock=.3;}
    if(this.wave<=6 && this.waveTime<WAVE_DURATION){this.spawnClock-=dt;if(this.spawnClock<=0){const count=this.wave>=4?2:1;for(let i=0;i<count;i++)this.spawnEnemy(this.chooseEnemy());this.spawnClock=this.wave===1?2.3:this.wave===2?2.05:this.wave===3?1.95:this.wave===4?2.65:this.wave===5?2.45:2.2;}}
    if(this.wave>=5&&this.wave<=6&&this.waveTime<WAVE_DURATION){this.hazardClock-=dt;if(this.hazardClock<=0){this.spawnHazard(this.player,2.5,1.7);if(this.wave===6)this.spawnHazard({x:this.player.x+this.player.vx*.65,z:this.player.z+this.player.vz*.65},2.3,2.1);this.hazardClock=8;}}
    for(const e of this.enemies){updateEnemy(e,dt,this.enemyContext);if(this.state!=='playing')return;}
    this.updateBullets(dt);if(this.state!=='playing')return;
    this.updatePickups(dt);this.updateHazards(dt);if(this.state!=='playing')return;this.updateDrone(dt);
    for(let i=this.enemies.length-1;i>=0;i--)if(this.enemies[i].dead){this.enemies[i].dispose(this.world.scene);this.enemies.splice(i,1);}
    if(this.pendingVictory){this.finish(true);return;}
    if((this.wave<7&&this.waveTime>=WAVE_DURATION&&this.enemies.length===0)||(this.wave===7&&this.bossSpawned&&this.enemies.length===0)){
      this.intermission+=dt;if(this.intermission>1.5)this.completeWave();
    }else this.intermission=0;
    this.audio.update(dt,this.wave/7);
  }
  private completeWave():void {
    if(this.wave>=7){this.finish(true);return;}
    this.bullets.clear();this.clearHazards();this.player.health=Math.min(this.player.build.maxHealth,this.player.health+25);this.player.model.group.visible=true;
    // Collect surviving salvage so a wave transition never deletes earned resources.
    for(const p of this.pickups){if(p.type==='energy'){this.player.energy=Math.min(100,this.player.energy+p.value);this.score+=10;}else this.player.health=Math.min(this.player.build.maxHealth,this.player.health+p.value);this.world.scene.remove(p.mesh);}this.pickups=[];
    this.choices=chooseUpgrades(this.owned);this.state='upgrade';this.input.clear();this.ui.upgrades(this.choices,this.wave);this.audio.wave();
  }
  selectUpgrade(id:string):void {
    if(this.state!=='upgrade')return;const chosen=this.choices.find(u=>u.id===id);if(!chosen)return;
    const oldMax=this.player.build.maxHealth;chosen.apply(this.player.build);this.player.health+=this.player.build.maxHealth-oldMax;this.owned.add(chosen.id);this.wave++;this.state='playing';this.input.clear();this.ui.show('playing');this.audio.ui();this.beginWave();this.updateHUD();
  }
  finish(win:boolean):void {
    if(this.state!=='playing')return;this.state='ended';this.input.clear();this.bullets.clear();this.clearHazards();this.player.model.group.visible=true;
    if(win){this.score+=Math.round(this.player.health)*25+Math.max(0,Math.round(600-this.elapsed))*10;this.effects.ring({x:0,z:0},COLORS.lime,35,2.5);this.effects.burst({x:0,z:0},COLORS.lime,140,18,3);this.audio.win();}
    else {this.effects.burst(this.player,COLORS.ivory,40,8);this.player.model.group.visible=false;this.audio.kill(true);}
    const savedBest=Number(readSave(this.runAssist?'best-assist':'best',0))||0;const newBest=this.score>savedBest;if(newBest){this.best=this.score;writeSave(this.runAssist?'best-assist':'best',this.score);}this.ui.end(win,this.score,newBest,this.wave,this.player.kills,this.elapsed,this.runAssist);
  }
  private updateHUD():void {
    const p=this.player,boss=this.enemies.find(e=>e.kind==='boss'&&!e.dead);
    this.ui.update({health:p.health,maxHealth:p.build.maxHealth,score:this.score,best:this.best,wave:this.wave,waveName:WAVE_NAMES[this.wave-1],remaining:Math.max(0,WAVE_DURATION-this.waveTime),progress:Math.min(1,this.waveTime/WAVE_DURATION),weapon:p.weapon,ammo:p.ammo[p.weapon],capacity:p.weapon===0?28:6,reload:p.reload>0?1-p.reload/p.reloadTotal:0,dash:p.dashCharges,dashProgress:p.dashRecharge/(p.build.quickDash?1.56:2.4),energy:p.energy,pulseCost:p.build.capacitor?70:100,combo:this.combo,kills:p.kills,time:this.elapsed,bossHealth:boss?boss.hp/boss.maxHp:null,upgrades:UPGRADES.filter(u=>this.owned.has(u.id)).map(u=>u.name)});
  }
  private frame(timestamp:number):void {
    requestAnimationFrame(t=>this.frame(t));const dt=Math.min(.033,Math.max(0,(timestamp-this.last)/1000));this.last=timestamp;this.time+=dt;
    if(this.input.consume('KeyM'))this.action('mute');
    if(this.input.consume('Escape')){if(this.ui.panelOpen)this.ui.closePanel();else if(this.state==='playing')this.pause();else if(this.state==='paused')this.action('resume');}
    if(this.state==='menu'&&this.input.consume('Enter')&&!this.ui.panelOpen)this.start();
    if(this.state==='upgrade')for(let i=0;i<3;i++)if(this.input.consume(`Digit${i+1}`)&&this.choices[i])this.selectUpgrade(this.choices[i].id);
    this.aim=this.world.aim(this.input.mouse.x,this.input.mouse.y);
    if(this.state==='playing'&&!this.ui.panelOpen){if(this.hitStop>0)this.hitStop-=dt;else this.updateGame(dt);}
    if(this.state==='playing'||this.state==='ended')this.effects.update(dt);
    this.hudClock-=dt;if(this.hudClock<=0){this.updateHUD();this.hudClock=.05;}
    this.ui.tick(dt,this.input.mouse);this.input.endFrame();
    this.world.update(dt,this.time,this.state==='menu',this.player,this.aim);
    this.world.aimRing.visible=this.world.aimLine.visible=this.state==='playing';
  }
}
