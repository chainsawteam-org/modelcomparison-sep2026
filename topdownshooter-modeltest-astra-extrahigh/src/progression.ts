export interface Build {
  damage:number; fireRate:number; speed:number; maxHealth:number; magnet:number;
  pierce:number; ricochet:boolean; blast:boolean; frost:boolean; dashDamage:boolean;
  quickDash:boolean; leech:boolean; capacitor:boolean; drone:boolean;
}
export const defaultBuild = ():Build => ({damage:1,fireRate:1,speed:1,maxHealth:100,magnet:3.1,pierce:0,ricochet:false,blast:false,frost:false,dashDamage:false,quickDash:false,leech:false,capacitor:false,drone:false});
export interface Upgrade {id:string;name:string;tag:string;icon:string;description:string;detail:string;apply:(b:Build)=>void}
export const UPGRADES:Upgrade[] = [
  {id:'pierce',name:'Throughline',tag:'BALLISTICS',icon:'↗',description:'Your rounds punch through two additional enemies.',detail:'Line them up. Let the rifle do the rest.',apply:b=>{b.pierce=2;}},
  {id:'blast',name:'Chain reaction',tag:'DEMOLITION',icon:'✳',description:'Destroyed enemies explode, damaging nearby hostiles.',detail:'Turn a crowded arena into an opportunity.',apply:b=>{b.blast=true;}},
  {id:'frost',name:'Cold circuit',tag:'CONTROL',icon:'❋',description:'Shots slow enemies by 35% for 1.5 seconds.',detail:'Create space. Break a charging enemy’s momentum.',apply:b=>{b.frost=true;}},
  {id:'dashDamage',name:'Phase blade',tag:'MOBILITY',icon:'»',description:'Dashing through an enemy deals 65 damage.',detail:'Your escape route is now a weapon.',apply:b=>{b.dashDamage=true;}},
  {id:'capacitor',name:'Feedback loop',tag:'DISCHARGE',icon:'ϟ',description:'Discharge costs 70 energy and restores 12 integrity.',detail:'Stay close to the fragments. Keep the loop alive.',apply:b=>{b.capacitor=true;}},
  {id:'drone',name:'Little satellite',tag:'COMPANION',icon:'◇',description:'An orbiting drone fires at the closest visible enemy.',detail:'A second set of eyes. And a second barrel.',apply:b=>{b.drone=true;}},
  {id:'ricochet',name:'Deflection',tag:'BALLISTICS',icon:'⌁',description:'Rounds ricochet once off walls and cover. +15% damage.',detail:'Find the angle. There’s always another way through.',apply:b=>{b.ricochet=true;b.damage*=1.15;}},
  {id:'quickDash',name:'Slipstream',tag:'MOBILITY',icon:'≋',description:'Dash recharges 35% faster. Move 12% faster.',detail:'Be somewhere else before the shot arrives.',apply:b=>{b.quickDash=true;b.speed*=1.12;}},
  {id:'leech',name:'Field repairs',tag:'SURVIVAL',icon:'+',description:'Every 6 eliminations restore 5 integrity. +20 maximum integrity.',detail:'Build yourself back from what’s left of them.',apply:b=>{b.leech=true;b.maxHealth+=20;}},
  {id:'overclock',name:'Overclock',tag:'FIREPOWER',icon:'↟',description:'Fire 22% faster and reload 20% faster.',detail:'The best defense is a very short conversation.',apply:b=>{b.fireRate*=1.22;}},
  {id:'magnet',name:'Salvage field',tag:'RECOVERY',icon:'◎',description:'Collect fragments from twice as far. +10% weapon damage.',detail:'Spend less time collecting. More time discharging.',apply:b=>{b.magnet*=2;b.damage*=1.1;}},
];
export const WAVE_NAMES=['First contact','Crossed frequencies','Heavy interference','Dead air','Critical mass','Last defense','The Warden'];
export const WAVE_HINTS=['Move, aim, and hold fire. Collect the green energy fragments.','Gunners incoming. Amber sights warn you before they shoot.','Chargers incoming. Step out of the pink line, or dash through.','Swarm signatures detected. Your scattergun clears groups.','Conduit surges detected. Leave the red circles before impact.','All signatures converging. Use cover. Keep moving.','Destroy the Warden to bring the relay back online.'];
export const WAVE_DURATION=45;
export function chooseUpgrades(owned:Set<string>):Upgrade[]{
  const pool=UPGRADES.filter(u=>!owned.has(u.id));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,3);
}
