import * as THREE from 'three';
import { playerModel, enemyModel, mat, COLORS, type ActorModel, type EnemyKind } from './models';
import { defaultBuild, type Build } from './progression';
import type { Point } from './math';

const templates = new Map<EnemyKind,ActorModel>();
function cloneEnemy(kind:EnemyKind):ActorModel {
  if(!templates.has(kind))templates.set(kind,enemyModel(kind));
  const t=templates.get(kind)!,group=t.group.clone(true),body=group.children[0] as THREE.Group,gun=body.children[t.body.children.indexOf(t.gun)] as THREE.Group;
  return {group,body,gun,legs:t.legs.map(l=>body.children[t.body.children.indexOf(l)]),glow:body.children[t.body.children.indexOf(t.glow)] as THREE.Mesh,flash:gun.children[t.gun.children.indexOf(t.flash)] as THREE.Mesh};
}
export class Player implements Point {
  x=0;z=6;vx=0;vz=0;angle=0;health=100;energy=35;
  model=playerModel();build:Build=defaultBuild();
  weapon=0;ammo=[28,6];reload=0;reloadTotal=0;fireTimer=0;
  dashCharges=2;dashRecharge=0;dashTime=0;dashDir:Point={x:0,z:1};dashHits=new Set<number>();
  invulnerable=0;hurt=0;recoil=0;walk=0;kills=0;
  reset():void {this.x=0;this.z=6;this.vx=0;this.vz=0;this.angle=0;this.health=100;this.energy=35;this.build=defaultBuild();this.weapon=0;this.ammo=[28,6];this.reload=0;this.fireTimer=0;this.dashCharges=2;this.dashRecharge=0;this.dashTime=0;this.invulnerable=1.8;this.hurt=0;this.recoil=0;this.kills=0;this.model.group.visible=true;}
}
export const ENEMY_STATS:Record<EnemyKind,{hp:number;speed:number;r:number;score:number}>={crawler:{hp:42,speed:2.5,r:.55,score:100},gunner:{hp:65,speed:2.15,r:.6,score:180},charger:{hp:155,speed:1.8,r:.88,score:280},swarm:{hp:19,speed:4.0,r:.37,score:65},boss:{hp:2600,speed:1.05,r:2.05,score:6000}};
let nextEnemyId=1;
export class Enemy implements Point {
  id=nextEnemyId++;x:number;z:number;hp:number;maxHp:number;r:number;speed:number;score:number;
  model:ActorModel;age=0;spawnTime=1.1;flash=0;slow=0;stun=0;attack=0;phase='move';phaseTime=0;
  target:Point={x:0,z:0};knock:Point={x:0,z:0};dead=false;pattern=0;strafe=Math.random()>.5?1:-1;
  tell:THREE.Mesh;hpBar:THREE.Mesh;private hpTrack:THREE.Mesh;
  constructor(public kind:EnemyKind,p:Point,wave:number){
    this.x=p.x;this.z=p.z;const s=ENEMY_STATS[kind];this.hp=this.maxHp=s.hp*(kind==='boss'?1:1+Math.max(0,wave-2)*.045);this.r=s.r;this.speed=s.speed;this.score=s.score;this.model=cloneEnemy(kind);
    this.model.group.position.set(this.x,0,this.z);
    this.tell=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:kind==='charger'?COLORS.pink:COLORS.amber,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide}));this.tell.rotation.x=-Math.PI/2;this.tell.visible=false;
    this.hpTrack=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.07),new THREE.MeshBasicMaterial({color:0x111f26}));this.hpTrack.rotation.x=-Math.PI/2;this.hpTrack.position.set(0,.05,-this.r-.4);this.model.group.add(this.hpTrack);
    this.hpBar=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.07),new THREE.MeshBasicMaterial({color:COLORS.red}));this.hpBar.rotation.x=-Math.PI/2;this.hpBar.position.copy(this.hpTrack.position);this.hpBar.position.y=.06;this.model.group.add(this.hpBar);this.hpBar.visible=false;this.hpTrack.visible=false;
    this.attack=1+Math.random()*1.4;
  }
  showTell(scene:THREE.Scene,from:Point,to:Point,width:number):void {if(!this.tell.parent)scene.add(this.tell);this.tell.visible=true;const d=Math.hypot(to.x-from.x,to.z-from.z);this.tell.position.set((from.x+to.x)/2,.045,(from.z+to.z)/2);this.tell.rotation.set(-Math.PI/2,0,-Math.atan2(to.x-from.x,to.z-from.z));this.tell.scale.set(width,d,1);}
  updateVisual(dt:number):void {
    this.age+=dt;this.flash=Math.max(0,this.flash-dt);this.model.group.position.set(this.x,0,this.z);
    const born=Math.min(1,(1.1-this.spawnTime)*4);this.model.group.scale.setScalar(Math.max(.01,born));
    this.model.body.position.y=this.kind==='gunner'||this.kind==='boss'?Math.sin(this.age*3)*.12:Math.sin(this.age*12)*.035;
    for(let i=0;i<this.model.legs.length;i++)this.model.legs[i].rotation.x=Math.sin(this.age*this.speed*5+i*Math.PI)*.3;
    this.model.body.scale.setScalar(1+this.flash*.7);
    this.hpBar.visible=this.hpTrack.visible=this.hp<this.maxHp && this.kind!=='boss';this.hpBar.scale.x=Math.max(.001,this.hp/this.maxHp);
    this.hpBar.position.x=-(1-this.hp/this.maxHp)*.6;
    this.model.glow.visible=this.flash<=0||Math.floor(this.flash*80)%2===0;
  }
  dispose(scene:THREE.Scene):void {scene.remove(this.model.group,this.tell);this.tell.geometry.dispose();(this.tell.material as THREE.Material).dispose();for(const m of [this.hpBar,this.hpTrack]){m.geometry.dispose();(m.material as THREE.Material).dispose();}}
}
export interface Bullet extends Point {vx:number;vz:number;damage:number;life:number;friendly:boolean;r:number;pierce:number;bounce:number;hit:Set<number>;mesh:THREE.Mesh;drone:boolean}
const bulletGeo=new THREE.SphereGeometry(1,6,4);
const friendlyMat=mat(COLORS.lime,2),hostileMat=mat(COLORS.red,1.2),droneMat=mat(COLORS.teal,1.5);
export class Bullets {
  items:Bullet[]=[];private pool:THREE.Mesh[]=[];
  constructor(private scene:THREE.Scene){}
  add(p:Point,dir:Point,speed:number,damage:number,friendly:boolean,life=1.1,pierce=0,bounce=0,drone=false):void {
    if(this.items.length>=420)return;
    const mesh=this.pool.pop()||new THREE.Mesh(bulletGeo,friendlyMat);mesh.material=friendly?drone?droneMat:friendlyMat:hostileMat;
    mesh.scale.set(friendly?.065:.18,friendly?.065:.18,friendly?.45:.25);mesh.rotation.y=Math.atan2(dir.x,dir.z);mesh.position.set(p.x,.7,p.z);mesh.visible=true;this.scene.add(mesh);
    this.items.push({...p,vx:dir.x*speed,vz:dir.z*speed,damage,life,friendly,r:friendly?.13:.22,pierce,bounce,hit:new Set(),mesh,drone});
  }
  remove(i:number):void {const b=this.items[i];this.scene.remove(b.mesh);this.pool.push(b.mesh);this.items.splice(i,1);}
  clear():void {for(let i=this.items.length-1;i>=0;i--)this.remove(i);}
}
const shardGeo=new THREE.OctahedronGeometry(.17), medGeo=new THREE.BoxGeometry(.5,.18,.5);
const shardMat=mat(COLORS.lime,.9),medMat=mat(COLORS.teal,1);
export interface Pickup extends Point {mesh:THREE.Mesh;life:number;type:'energy'|'health';age:number;value:number}
export function makePickup(p:Point,type:Pickup['type'],value:number):Pickup {const mesh=new THREE.Mesh(type==='energy'?shardGeo:medGeo,type==='energy'?shardMat:medMat);mesh.position.set(p.x,.35,p.z);return{...p,type,value,mesh,life:30,age:0};}
export interface Hazard extends Point {mesh:THREE.Mesh;timer:number;radius:number;triggered:boolean;owner:'enemy'|'barrel'}
export interface Barrel extends Point {mesh:THREE.Group;hp:number;alive:boolean}
