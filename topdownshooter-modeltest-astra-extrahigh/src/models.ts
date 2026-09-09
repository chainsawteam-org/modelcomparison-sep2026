import * as THREE from 'three';

export const COLORS = { lime: 0xd6fa89, teal: 0x79e5d5, red: 0xff725f, pink: 0xed80b9, amber: 0xffc16e, dark: 0x243840, ivory: 0xe5e9d9 };
const materials = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: number, glow = 0, metal = 0.25): THREE.MeshStandardMaterial {
  const key = `${color}/${glow}/${metal}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: metal, emissive: color, emissiveIntensity: glow }));
  return materials.get(key)!;
}
const boxGeo = new THREE.BoxGeometry(1,1,1);
const sphereGeo = new THREE.IcosahedronGeometry(1,1);
export function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo, material); m.scale.set(w,h,d); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function cylinder(parent: THREE.Object3D, top: number, bottom: number, h: number, x: number, y: number, z: number, material: THREE.Material, segments = 12): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,segments), material); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export function ring(parent: THREE.Object3D, radius: number, color: number, thickness = 0.04): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius,thickness,5,64), mat(color,0.8)); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; parent.add(m); return m;
}
export interface ActorModel { group: THREE.Group; body: THREE.Group; legs: THREE.Object3D[]; gun: THREE.Group; glow: THREE.Mesh; flash: THREE.Mesh }
export function playerModel(): ActorModel {
  const group = new THREE.Group(), body = new THREE.Group(), gun = new THREE.Group(); group.add(body); body.add(gun);
  const legs = [-1,1].map(side => box(body,0.26,0.45,0.34,side*0.25,0.36,0,mat(0x1b2d36)));
  box(body,0.74,0.64,0.46,0,0.9,0,mat(COLORS.ivory));
  box(body,0.79,0.17,0.51,0,1.06,0,mat(0x9bafa5));
  box(body,0.5,0.5,0.26,0,0.95,-0.32,mat(COLORS.dark));
  box(body,0.38,0.09,0.04,0,1.08,-0.47,mat(COLORS.teal,1.3));
  cylinder(body,0.31,0.32,0.42,0,1.46,0,mat(COLORS.ivory),8);
  const glow = box(body,0.48,0.15,0.18,0,1.47,0.26,mat(COLORS.lime,1.1));
  box(body,0.26,0.35,0.3,-0.5,0.98,0.1,mat(COLORS.ivory));
  box(body,0.26,0.35,0.3,0.5,0.98,0.1,mat(COLORS.ivory));
  gun.position.set(0.39,0.95,0.33);
  box(gun,0.22,0.25,0.91,0,0,0.32,mat(0x12232d));
  box(gun,0.12,0.07,0.48,0,0.15,0.31,mat(COLORS.lime,0.5));
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.27), mat(0xe4ffb8,3)); flash.position.z = 0.91; flash.scale.set(0.6,0.6,2); flash.visible = false; gun.add(flash);
  ring(group,0.64,COLORS.lime,0.035);
  return { group,body,legs,gun,glow,flash };
}
export type EnemyKind = 'crawler' | 'gunner' | 'charger' | 'swarm' | 'boss';
export const enemyColors: Record<EnemyKind, number> = { crawler: COLORS.red, gunner: COLORS.amber, charger: COLORS.pink, swarm: COLORS.red, boss: COLORS.red };
export function enemyModel(kind: EnemyKind): ActorModel {
  const group = new THREE.Group(), body = new THREE.Group(), gun = new THREE.Group(); group.add(body); body.add(gun);
  const color = enemyColors[kind], legs: THREE.Object3D[] = [];
  let glow: THREE.Mesh;
  if (kind === 'boss') {
    cylinder(body,1.9,2.2,0.65,0,1.5,0,mat(0x34454b),10);
    cylinder(body,1.45,1.8,0.5,0,1.97,0,mat(0x788481),10);
    glow = cylinder(body,0.85,1.05,0.48,0,2.4,0,mat(COLORS.red,1.2),10);
    ring(body,1.72,COLORS.red,0.1).position.y = 1.9;
    for (let i = 0; i < 6; i++) {
      const arm = new THREE.Group(); arm.rotation.y = i * Math.PI / 3; body.add(arm);
      box(arm,0.55,0.5,1.65,0,1.4,2,mat(0x23343f));
      box(arm,0.32,0.2,0.8,0,1.7,2.3,mat(color,0.7)); legs.push(arm);
    }
  } else if (kind === 'gunner') {
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.75),mat(0x72584a)); orb.position.y = 1.1; body.add(orb); orb.castShadow = true;
    glow = new THREE.Mesh(sphereGeo,mat(color,0.9)); glow.scale.set(0.31,0.31,0.31); glow.position.set(0,1.1,0.53); body.add(glow);
    for (const s of [-1,1]) box(body,0.14,0.75,0.9,s*0.66,1.15,0,mat(COLORS.amber,0.1));
    ring(group,0.7,color,0.025);
    box(gun,0.17,0.17,0.7,0,0.9,0.66,mat(COLORS.dark));
  } else {
    const heavy = kind === 'charger', small = kind === 'swarm';
    const size = heavy ? 1.25 : small ? 0.55 : 0.8;
    box(body,size,heavy ? 0.72 : 0.46,size*1.05,0,0.7,0,mat(heavy ? 0x684657 : 0x684e48));
    box(body,size*0.8,0.16,size*0.75,0,1.03,0,mat(color,0.12));
    glow = box(body,size*0.7,0.14,0.12,0,0.8,size*0.56,mat(color,1));
    for (const s of [-1,1]) for (const t of [-1,1]) {
      const leg = box(body,0.16,0.27,size*0.55,s*size*0.67,0.3,t*size*0.4,mat(0x25323b)); leg.rotation.z = s * 0.35; legs.push(leg);
    }
    if (heavy) for (const s of [-1,1]) {
      box(body,0.3,0.6,0.9,s*0.7,0.9,0.3,mat(COLORS.pink,0.15));
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.7,4),mat(COLORS.ivory)); horn.rotation.x = Math.PI/2; horn.position.set(s*0.68,0.95,1); body.add(horn);
    }
  }
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.2),mat(color,2)); flash.position.set(0,1,1); flash.visible=false; gun.add(flash);
  return {group,body,legs,gun,glow,flash};
}
