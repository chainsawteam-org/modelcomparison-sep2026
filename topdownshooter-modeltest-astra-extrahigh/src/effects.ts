import * as THREE from 'three';
import { rand } from './math';
import type { Point } from './math';
interface Particle {x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;max:number;size:number;color:THREE.Color}
interface Shockwave {mesh:THREE.Mesh;life:number;max:number;radius:number}
export class Effects {
  private particles: Particle[]=[];
  private capacity=900;
  private mesh: THREE.InstancedMesh;
  private dummy=new THREE.Object3D();
  private rings: Shockwave[]=[];
  constructor(private scene: THREE.Scene) {
    this.mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff}),this.capacity);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;scene.add(this.mesh);
  }
  burst(p:Point,color:number,count=12,force=5,y=0.7):void {
    for(let i=0;i<count && this.particles.length<this.capacity;i++){const angle=rand(0,Math.PI*2),speed=rand(.3,1)*force,life=rand(.18,.6);this.particles.push({x:p.x,y,z:p.z,vx:Math.cos(angle)*speed,vy:rand(1,5),vz:Math.sin(angle)*speed,life,max:life,size:rand(.045,.16),color:new THREE.Color(color)});}
  }
  trail(p:Point,color:number):void {this.burst(p,color,2,.8,.5);}
  ring(p:Point,color:number,radius:number,duration=.5):void {
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.94,1,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(p.x,.06,p.z);this.scene.add(mesh);this.rings.push({mesh,life:duration,max:duration,radius});
  }
  update(dt:number):void {
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=15*dt;if(p.y<.06){p.y=.06;p.vy*=-.25;p.vx*=.7;p.vz*=.7;}}
    this.mesh.count=this.particles.length;
    for(let i=0;i<this.particles.length;i++){const p=this.particles[i],f=p.life/p.max;this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.life*5,p.life*3,0);this.dummy.scale.setScalar(p.size*Math.min(1,f*3));this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.mesh.setColorAt(i,p.color);}
    this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
    for(let i=this.rings.length-1;i>=0;i--){const r=this.rings[i];r.life-=dt;if(r.life<=0){this.scene.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();this.rings.splice(i,1);}else{const f=1-r.life/r.max;r.mesh.scale.setScalar(.2+(1-(1-f)**3)*r.radius);(r.mesh.material as THREE.MeshBasicMaterial).opacity=(1-f)*.75;}}
  }
  clear():void {this.particles=[];this.mesh.count=0;for(const r of this.rings){this.scene.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();}this.rings=[];}
}
