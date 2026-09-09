import type { Enemy, Player, Bullets } from './entities';
import type { World } from './world';
import type { Navigation, Point } from './math';
import { clearLine, dist2, moveCircle, normalize, rand } from './math';
import type { AudioSystem } from './audio';
import type { Effects } from './effects';
import { COLORS } from './models';
export interface EnemyContext {player:Player;enemies:Enemy[];world:World;nav:Navigation;bullets:Bullets;audio:AudioSystem;effects:Effects;damagePlayer:(n:number)=>void;hazard:(p:Point,radius:number,timer:number)=>void;summon:(p:Point)=>void;notice:(text:string)=>void}

export function updateEnemy(e:Enemy,dt:number,c:EnemyContext):void {
  if(e.dead)return;
  e.spawnTime=Math.max(0,e.spawnTime-dt);e.slow=Math.max(0,e.slow-dt);e.stun=Math.max(0,e.stun-dt);e.attack-=dt;
  const p=c.player,world=c.world,obs=world.obstacles;
  if(e.spawnTime>0){e.updateVisual(dt);return;}
  const delta={x:p.x-e.x,z:p.z-e.z},distance=Math.hypot(delta.x,delta.z),dir=normalize(delta.x,delta.z);
  let move:Point={x:0,z:0};let speed=e.speed*(e.slow>0?.65:1);
  const visible=clearLine(e,p,obs,.1);
  if(e.kind==='boss') {
    const enraged=e.hp/e.maxHp<.45;
    if(enraged && e.pattern<100){e.pattern+=100;c.notice('WARDEN ENRAGED — STAY MOBILE');c.audio.danger();c.effects.ring(e,COLORS.red,5,1);}
    if(distance>9)move=c.nav.direction(e,p,obs,e.r);
    else if(distance<5)move={x:-dir.x,z:-dir.z};
    else move={x:dir.z*.45,z:-dir.x*.45};
    e.model.body.rotation.y+=dt*.3;
    if(e.phase==='warning') {
      e.phaseTime-=dt;
      e.showTell(world.scene,e,e.target,1.3);
      if(e.phaseTime<=0) {
        const aim=normalize(e.target.x-e.x,e.target.z-e.z),angle=Math.atan2(aim.x,aim.z);
        for(let i=-3;i<=3;i++){const a=angle+i*.15;c.bullets.add({x:e.x+aim.x*2.4,z:e.z+aim.z*2.4},{x:Math.sin(a),z:Math.cos(a)},enraged?13:11,13,false,3.7);}
        e.phase='move';e.tell.visible=false;e.attack=enraged?1.7:2.3;c.audio.shoot(true);
      }
    } else if(e.attack<=0) {
      e.pattern++;
      if(e.pattern%3===0) {
        const count=enraged?22:16,offset=e.age*.7;
        for(let i=0;i<count;i++){const a=i/count*Math.PI*2+offset;const d={x:Math.sin(a),z:Math.cos(a)};c.bullets.add({x:e.x+d.x*2.5,z:e.z+d.z*2.5},d,enraged?8.2:6.8,12,false,6);}
        c.effects.ring(e,COLORS.red,3.5,.5);c.audio.danger();e.attack=enraged?2:2.7;
      } else if(e.pattern%3===1){
        c.hazard({x:p.x,z:p.z},2.6,1.5);c.hazard({x:p.x+p.vx*.55,z:p.z+p.vz*.55},2.6,2.1);
        if(enraged)c.hazard({x:p.x-p.vz*.5,z:p.z+p.vx*.5},2.4,1.8);
        e.attack=enraged?2:2.8;
        if(c.enemies.length<9)c.summon({x:e.x+rand(-3,3),z:e.z+3.5});
      } else {e.phase='warning';e.phaseTime=.85;e.target={x:p.x+p.vx*.3,z:p.z+p.vz*.3};}
    }
  } else if(e.kind==='gunner') {
    if(e.phase==='warning') {
      e.phaseTime-=dt;
      e.model.body.rotation.y=Math.atan2(e.target.x-e.x,e.target.z-e.z);e.showTell(world.scene,e,e.target,.13);
      if(e.phaseTime<=0){const aim=normalize(e.target.x-e.x,e.target.z-e.z),a=Math.atan2(aim.x,aim.z);for(let i=-1;i<=1;i++)c.bullets.add({x:e.x+aim.x*.85,z:e.z+aim.z*.85},{x:Math.sin(a+i*.13),z:Math.cos(a+i*.13)},10,9,false,3.8);e.phase='move';e.tell.visible=false;e.attack=2.6+Math.random()*.4;c.audio.reload();}
    } else {
      if(!visible || distance>11)move=c.nav.direction(e,p,obs,e.r);
      else if(distance<7.2)move={x:-dir.x,z:-dir.z};
      else move={x:dir.z*.65*e.strafe,z:-dir.x*.65*e.strafe};
      e.model.body.rotation.y=Math.atan2(dir.x,dir.z);
      if(e.attack<=0 && visible && distance<18){e.phase='warning';e.phaseTime=.8;e.target={x:p.x+p.vx*.18,z:p.z+p.vz*.18};}
    }
  } else if(e.kind==='charger') {
    if(e.phase==='warning') {
      e.phaseTime-=dt;e.showTell(world.scene,e,e.target,1.7);e.model.body.position.z=Math.sin(e.phaseTime*65)*.05;
      if(e.phaseTime<=0){e.phase='charge';e.phaseTime=.72;e.tell.visible=false;c.audio.dash();}
    } else if(e.phase==='charge') {
      e.phaseTime-=dt;move=normalize(e.target.x-e.x,e.target.z-e.z);speed=17*(e.slow>0?.65:1);c.effects.trail(e,COLORS.pink);
      if(e.phaseTime<=0 || dist2(e,e.target)<.8){e.phase='recover';e.phaseTime=.85;}
    } else if(e.phase==='recover') {e.phaseTime-=dt;if(e.phaseTime<=0){e.phase='move';e.attack=2.1;}}
    else {
      move=c.nav.direction(e,p,obs,e.r);e.model.body.rotation.y=Math.atan2(move.x,move.z);
      if(e.attack<=0 && distance<13 && distance>3 && visible){e.phase='warning';e.phaseTime=.95;e.target={x:e.x+dir.x*13,z:e.z+dir.z*13};e.model.body.rotation.y=Math.atan2(dir.x,dir.z);}
    }
  } else {
    move=c.nav.direction(e,p,obs,e.r);
    if(e.kind==='swarm' && distance>3 && visible){const sway=Math.sin(e.age*2+e.id)*.3;move=normalize(move.x+dir.z*sway,move.z-dir.x*sway);}
    e.model.body.rotation.y=Math.atan2(move.x,move.z);
  }
  if(e.stun>0){move={x:0,z:0};e.tell.visible=false;if(e.phase==='warning'){e.phase='move';e.attack=1.5;}}
  if(e.phase!=='charge') {
    let sx=0,sz=0;
    for(const other of c.enemies){if(other===e||other.dead||other.spawnTime>0)continue;const dx=e.x-other.x,dz=e.z-other.z,ds=dx*dx+dz*dz,min=e.r+other.r+.2;if(ds<min*min&&ds>.0001){const d=Math.sqrt(ds),f=(min-d)/min;sx+=dx/d*f;sz+=dz/d*f;}}
    move.x+=sx*1.3;move.z+=sz*1.3;
    const len=Math.hypot(move.x,move.z);if(len>1.35){move.x/=len/1.35;move.z/=len/1.35;}
  }
  const oldX=e.x,oldZ=e.z;
  moveCircle(e,move.x*speed*dt+e.knock.x*dt,move.z*speed*dt+e.knock.z*dt,e.r,obs);
  e.knock.x*=Math.exp(-dt*9);e.knock.z*=Math.exp(-dt*9);
  if(e.phase==='charge' && Math.hypot(e.x-oldX,e.z-oldZ)<speed*dt*.25){e.phase='recover';e.phaseTime=1.1;c.effects.burst(e,COLORS.pink,12,4);}
  if(distance<e.r+.46 && e.stun<=0)c.damagePlayer(e.kind==='charger'?e.phase==='charge'?24:15:e.kind==='boss'?22:e.kind==='swarm'?7:10);
  e.updateVisual(dt);
}
