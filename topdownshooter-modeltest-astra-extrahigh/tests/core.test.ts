import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentCircle,moveCircle,Navigation,dist2,normalize,clearLine} from '../src/math.ts';
import {chooseUpgrades,UPGRADES,defaultBuild} from '../src/progression.ts';

test('swept rounds hit small targets even when crossing in one frame',()=>{
  assert.equal(segmentCircle({x:-10,z:0},{x:10,z:0},{x:0,z:0},1),.45);
  assert.equal(segmentCircle({x:-10,z:2},{x:10,z:2},{x:0,z:0},1),null);
  assert.equal(segmentCircle({x:0,z:0},{x:0,z:0},{x:0,z:0},1),0);
  assert.equal(segmentCircle({x:2,z:0},{x:3,z:0},{x:0,z:0},1),null);
});
test('fast dashes cannot tunnel through cover or escape arena boundaries',()=>{
  const p={x:-5,z:0};moveCircle(p,15,0,.43,[{x:0,z:0,r:2}]);assert.ok(p.x<=-2.42);
  moveCircle(p,-200,200,.43,[]);assert.ok(p.x>=-19.57&&p.z<=14.57);
});
test('diagonal movement is normalized and sliding preserves clearance',()=>{
  assert.ok(Math.abs(Math.hypot(...Object.values(normalize(1,1)))-1)<1e-10);
  const p={x:-2.5,z:0},obs=[{x:0,z:0,r:2}];for(let i=0;i<100;i++){moveCircle(p,.03,.07,.43,obs);assert.ok(dist2(p,obs[0])>2.429**2);}assert.ok(p.z>5);
});
test('flow navigation routes around relay and cooling units without softlock',()=>{
  const obstacles=[{x:0,z:0,r:1.65},{x:-8,z:-5.4,r:1.9},{x:8,z:5.4,r:1.9},{x:9,z:-6,r:1.65},{x:-9,z:6,r:1.65}];
  for(const r of [.37,.55,.88])for(const start of [{x:0,z:-13},{x:-18,z:0},{x:18,z:0},{x:0,z:13}])for(const target of [{x:0,z:6},{x:-8,z:8},{x:8,z:-10},{x:-16,z:-10}]){
    const nav=new Navigation(obstacles),p={...start};nav.update(target);
    for(let i=0;i<3000&&dist2(p,target)>1;i++){const d=nav.direction(p,target,obstacles,r);moveCircle(p,d.x*.06,d.z*.06,r,obstacles);}
    assert.ok(dist2(p,target)<1.5,`radius ${r}, ${JSON.stringify(start)} -> ${JSON.stringify(target)} stuck at ${JSON.stringify(p)}`);
  }
});
test('cover occludes both incoming and outgoing lines',()=>{
  assert.equal(clearLine({x:-3,z:0},{x:3,z:0},[{x:0,z:0,r:1}]),false);
  assert.equal(clearLine({x:3,z:0},{x:-3,z:0},[{x:0,z:0,r:1}]),false);
  assert.equal(clearLine({x:-3,z:2},{x:3,z:2},[{x:0,z:0,r:1}]),true);
});
test('six distinct augmentation choices remain possible across a complete run',()=>{
  const owned=new Set<string>(),build=defaultBuild();for(let wave=0;wave<6;wave++){
    const choices=chooseUpgrades(owned);assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.id)).size,3);assert.ok(choices.every(c=>!owned.has(c.id)));choices[0].apply(build);owned.add(choices[0].id);
  }assert.equal(owned.size,6);assert.ok(build.maxHealth>=100);assert.ok(UPGRADES.every(u=>u.description.length>20));
});
