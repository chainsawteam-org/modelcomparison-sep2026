import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cylinder, ring, mat, COLORS } from './models';
import type { Obstacle, Point } from './math';
import { lerp } from './math';

export class World {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-30,30,20,-20,0.1,200);
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  obstacles: Obstacle[] = [{x:0,z:0,r:1.65},{x:-8,z:-5.4,r:1.9},{x:8,z:5.4,r:1.9},{x:9,z:-6,r:1.65},{x:-9,z:6,r:1.65}];
  core = new THREE.Group();
  coreRings: THREE.Mesh[] = [];
  ports: THREE.Group[] = [];
  aimRing: THREE.Mesh;
  aimLine: THREE.Line;
  quality = true;
  shake = 0;
  motion = true;
  private target = new THREE.Vector3(-10,0,0);
  private ray = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0,1,0),-0.65);
  private aimResult = new THREE.Vector3();
  private staticGroup = new THREE.Group();
  private dust: THREE.Points;
  constructor(host: HTMLElement) {
    this.scene.background = new THREE.Color(0x101e25);
    this.scene.fog = new THREE.FogExp2(0x101e25,0.009);
    this.renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Last Signal 3D combat arena');
    this.scene.add(new THREE.HemisphereLight(0xbedce3,0x182e34,2.1));
    const sun = new THREE.DirectionalLight(0xffe9c8,3.0); sun.position.set(-14,28,12); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-30; sun.shadow.camera.right=30; sun.shadow.camera.top=26; sun.shadow.camera.bottom=-26;
    sun.shadow.normalBias=0.025; sun.shadow.bias=-0.0002; this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x77d9cf,1.2); rim.position.set(14,10,-20); this.scene.add(rim);
    this.scene.add(this.staticGroup);
    this.buildArena(); this.buildCore(); this.mergeStatic();
    const dustGeo = new THREE.BufferGeometry(), positions = new Float32Array(180*3);
    for(let i=0;i<180;i++){ positions[i*3]=(Math.random()-.5)*75; positions[i*3+1]=Math.random()*15-4; positions[i*3+2]=(Math.random()-.5)*55; }
    dustGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.dust = new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x9ed9ca,size:0.06,transparent:true,opacity:0.5,depthWrite:false})); this.scene.add(this.dust);
    this.aimRing = ring(this.scene,0.3,COLORS.lime,0.025); this.aimRing.visible=false;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
    this.aimLine = new THREE.Line(lineGeo,new THREE.LineDashedMaterial({color:COLORS.lime,transparent:true,opacity:0.12,dashSize:0.17,gapSize:0.23})); this.aimLine.visible=false; this.scene.add(this.aimLine);
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.28,0.4,1.05); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.resize(); addEventListener('resize',()=>this.resize());
  }
  private deckShape(w: number,d: number,c: number): THREE.Shape {
    const s = new THREE.Shape(); s.moveTo(-w/2+c,-d/2); s.lineTo(w/2-c,-d/2);s.lineTo(w/2,-d/2+c);s.lineTo(w/2,d/2-c);s.lineTo(w/2-c,d/2);s.lineTo(-w/2+c,d/2);s.lineTo(-w/2,d/2-c);s.lineTo(-w/2,-d/2+c);s.closePath();return s;
  }
  private buildArena(): void {
    const baseGeo = new THREE.ExtrudeGeometry(this.deckShape(44,34,3),{depth:1.4,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:0.2,bevelThickness:0.15}); baseGeo.rotateX(-Math.PI/2);
    const base = new THREE.Mesh(baseGeo,mat(0x23353c));base.position.y=-1.55; base.receiveShadow=true;this.staticGroup.add(base);
    const floorGeo = new THREE.ShapeGeometry(this.deckShape(42,32,2));floorGeo.rotateX(-Math.PI/2);
    // World-space UVs keep the locally generated deck artwork proportional.
    const p=floorGeo.getAttribute('position'), uv=floorGeo.getAttribute('uv');for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+21)/42,1-(p.getZ(i)+16)/32);
    const floorMat = new THREE.MeshStandardMaterial({map:this.floorTexture(),roughness:0.92,metalness:0.15});
    const floor = new THREE.Mesh(floorGeo,floorMat);floor.position.y=0;floor.receiveShadow=true;this.staticGroup.add(floor);
    for(const side of [-1,1]) {
      for(let x=-16;x<=16;x+=4) {
        box(this.staticGroup,3.8,0.48,0.38,x,0.17,side*15.8,mat(0x43565a));
        box(this.staticGroup,1.4,0.035,0.13,x,0.43,side*15.8,mat(x%8===0?COLORS.teal:0x86958a,x%8===0?1:0));
      }
      for(let z=-12;z<=12;z+=4) {
        box(this.staticGroup,0.38,0.48,3.8,side*20.8,0.17,z,mat(0x43565a));
        box(this.staticGroup,0.13,0.035,1.4,side*20.8,0.43,z,mat(COLORS.teal,0.7));
      }
      for(const x of [-16,16]) {
        cylinder(this.staticGroup,0.2,0.3,2.3,x,1.05,side*14.5,mat(0x718787),6);
        box(this.staticGroup,0.35,0.5,0.35,x,2.05,side*14.5,mat(COLORS.teal,1.5));
      }
    }
    for(const [idx,o] of this.obstacles.entries()) {
      if(idx===0)continue;
      const g=this.staticGroup;
      cylinder(g,o.r+0.18,o.r+0.28,0.22,o.x,0.11,o.z,mat(0x23363a),8);
      cylinder(g,o.r*0.85,o.r*0.98,1.5,o.x,0.88,o.z,mat(0x657976),8);
      cylinder(g,o.r*0.93,o.r*0.93,0.16,o.x,1.68,o.z,mat(0x93a39a),8);
      cylinder(g,o.r*0.6,o.r*0.6,0.18,o.x,1.83,o.z,mat(0x283e45),12);
      for(let a=0;a<4;a++){ const ang=a*Math.PI/2;box(g,0.2,0.6,0.2,o.x+Math.cos(ang)*o.r*.9,0.95,o.z+Math.sin(ang)*o.r*.9,mat(COLORS.teal,0.8)); }
      const rr=ring(g,o.r+0.5,0x577b76,0.025);rr.position.set(o.x,0.025,o.z);
      for(let j=-2;j<=2;j++)box(g,1.3,0.04,0.09,o.x,1.94,o.z+j*.2,mat(0x78938a));
    }
    for(const [x,z,rotation] of [[0,-14.8,0],[19.8,0,Math.PI/2],[0,14.8,Math.PI],[-19.8,0,-Math.PI/2]]) {
      const port = new THREE.Group();port.position.set(x,0.05,z);port.rotation.y=rotation;
      box(port,4,0.08,1.6,0,0,0,mat(0x1b2f38));
      for(const s of [-1,1]){box(port,0.22,1.3,0.5,s*2.2,0.65,0,mat(0x839790));box(port,0.1,0.8,0.12,s*2.2,0.8,0.27,mat(COLORS.red,0.8));}
      this.scene.add(port);this.ports.push(port);
    }
    // The relay is suspended above a quiet, fog-filled industrial city.
    for(let i=0;i<32;i++) {
      const angle=i*2.39996, radius=32+(i%5)*5;
      const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius, height=6+(i*7%17);
      box(this.staticGroup,4+i%4,height,4+(i*3%5),x,-12-height/2,z,mat(0x182c35));
      if(i%3===0)box(this.staticGroup,0.08,3,0.08,x+2,-10,z,mat(0x55887e,0.5));
    }
  }
  private floorTexture(): THREE.CanvasTexture {
    const c=document.createElement('canvas');c.width=1680;c.height=1280;const ctx=c.getContext('2d')!;
    ctx.fillStyle='#455958';ctx.fillRect(0,0,c.width,c.height);
    let seed=23;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let y=0;y<1280;y+=80)for(let x=0;x<1680;x+=80){ctx.fillStyle=`rgba(${random()>.5?'160,185,166':'5,25,35'},${0.025+random()*.025})`;ctx.fillRect(x+1,y+1,78,78);ctx.strokeStyle='#344b4d';ctx.lineWidth=1;ctx.strokeRect(x,y,80,80);}
    for(let i=0;i<15000;i++){ctx.fillStyle=`rgba(210,231,204,${random()*.045})`;ctx.fillRect(random()*1680,random()*1280,random()*2+1,random()*2+1);}
    ctx.strokeStyle='#71817a';ctx.lineWidth=2;ctx.strokeRect(55,55,1570,1170);
    ctx.setLineDash([15,12]);ctx.strokeStyle='#839185';ctx.strokeRect(100,100,1480,1080);ctx.setLineDash([]);
    ctx.strokeStyle='#8f9e8b';ctx.globalAlpha=.45;ctx.lineWidth=3;
    for(const r of [145,185]){ctx.beginPath();ctx.arc(840,640,r,0,Math.PI*2);ctx.stroke();}
    for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(840+s*200,640);ctx.lineTo(840+s*660,640);ctx.stroke();ctx.beginPath();ctx.moveTo(840,640+s*200);ctx.lineTo(840,640+s*500);ctx.stroke();}
    ctx.globalAlpha=1;
    ctx.fillStyle='#9ba997';ctx.font='bold 49px monospace';ctx.textAlign='center';ctx.fillText('RELAY  /  09',840,930);
    ctx.font='16px monospace';ctx.fillStyle='#93a397';ctx.fillText('AUTONOMOUS COMMUNICATIONS ARRAY',840,960);
    ctx.font='bold 85px monospace';ctx.globalAlpha=.24;ctx.fillText('09',330,385);ctx.globalAlpha=1;
    ctx.font='16px monospace';ctx.textAlign='left';ctx.fillStyle='#a5b0a1';ctx.fillText('N  /  INBOUND',755,142);ctx.fillText('CAUTION — LIVE CONDUIT',104,1140);
    for(const s of [-1,1])for(let i=0;i<8;i++){ctx.save();ctx.translate(840+s*610,480+i*37);ctx.rotate(-.6);ctx.fillStyle='#a3ac85';ctx.fillRect(-18,-5,36,10);ctx.restore();}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
  }
  private buildCore(): void {
    this.scene.add(this.core);
    cylinder(this.core,1.6,1.8,0.35,0,.18,0,mat(0x9aaa9d),12);
    cylinder(this.core,1.12,1.35,0.5,0,.59,0,mat(0x273f46),12);
    cylinder(this.core,.62,.85,2.3,0,1.7,0,mat(0x536e6d),8);
    cylinder(this.core,.35,.5,.9,0,3.2,0,mat(COLORS.teal,.8),8);
    cylinder(this.core,.07,.13,2,0,4.1,0,mat(0xb1c1af),6);
    for(let i=0;i<3;i++) {const rr=ring(this.core,1.05-i*.16,COLORS.teal,.055);rr.position.y=1.25+i*.64;this.coreRings.push(rr);}
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const arm=new THREE.Group();arm.rotation.y=a;this.core.add(arm);box(arm,.2,1.5,.24,0,1.35,1.1,mat(0x9eafa2));box(arm,.16,.55,.12,0,1.6,1.24,mat(COLORS.lime,1));}
    const light=new THREE.PointLight(COLORS.teal,12,8,2);light.position.set(0,2.5,0);this.scene.add(light);
  }
  private mergeStatic(): void {
    this.staticGroup.updateMatrixWorld(true);
    const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
    this.staticGroup.traverse(o=>{if(o instanceof THREE.Mesh && !Array.isArray(o.material)){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);const batch=batches.get(o.material)||[];batch.push(g);batches.set(o.material,batch);}});
    this.staticGroup.clear();
    for(const [material,geometries] of batches){const geo=mergeGeometries(geometries);if(geo){const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;this.staticGroup.add(mesh);}geometries.forEach(g=>g.dispose());}
  }
  resize(): void {
    const aspect=innerWidth/innerHeight;const h=Math.max(33,47/aspect);
    this.camera.left=-h*aspect/2;this.camera.right=h*aspect/2;this.camera.top=h/2;this.camera.bottom=-h/2;this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);this.composer.setSize(innerWidth,innerHeight);
  }
  setQuality(high: boolean): void {this.quality=high;this.renderer.shadowMap.enabled=high;this.bloom.enabled=high;this.renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.75:1));this.resize();}
  aim(x: number,y: number): Point {this.ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),this.camera);this.ray.ray.intersectPlane(this.ground,this.aimResult);return{x:this.aimResult.x,z:this.aimResult.z};}
  project(p: Point,y=1): {x:number;y:number} {const v=new THREE.Vector3(p.x,y,p.z).project(this.camera);return{x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight};}
  update(dt: number,time: number,menu: boolean,player: Point,aim: Point): void {
    const tx=menu?-11:player.x*.06,tz=menu?-1:player.z*.04;
    this.target.x=lerp(this.target.x,tx,1-Math.exp(-dt*3));this.target.z=lerp(this.target.z,tz,1-Math.exp(-dt*3));
    this.shake=Math.max(0,this.shake-dt*2.2);const amount=this.motion?this.shake*.16:0;
    this.camera.position.set(this.target.x+(Math.random()-.5)*amount,37,this.target.z+28+(Math.random()-.5)*amount);this.camera.lookAt(this.target.x,0,this.target.z);this.camera.updateMatrixWorld();
    for(let i=0;i<this.coreRings.length;i++){this.coreRings[i].rotation.z=time*(.2+i*.1);this.coreRings[i].scale.setScalar(1+Math.sin(time*2+i)*.035);}
    this.dust.rotation.y=Math.sin(time*.02)*.1;
    this.aimRing.visible=!menu;this.aimLine.visible=!menu;
    this.aimRing.position.set(aim.x,.04,aim.z);
    const positions=this.aimLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    positions.setXYZ(0,player.x,.65,player.z);positions.setXYZ(1,aim.x,.65,aim.z);positions.needsUpdate=true;this.aimLine.computeLineDistances();
    this.composer.render();
  }
}
