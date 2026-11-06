import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eyeFeature, predict, medianFeature, targets, validationTargets } from './gaze.js';
test('requires one face with iris landmarks', () => {
  assert.equal(eyeFeature([]), null);
  assert.equal(eyeFeature([[], []]), null);
  assert.equal(eyeFeature([Array(468).fill({x:0,y:0})]), null);
});
test('extracts eye-relative features and rejects closed eyes', () => {
  const face = Array.from({length:478}, () => ({x:.5,y:.5}));
  for (const [a,b,u,l,i] of [[33,133,159,145,468],[362,263,386,374,473]]) {
    face[a]={x:.2,y:.5}; face[b]={x:.4,y:.5};
    face[u]={x:.3,y:.47}; face[l]={x:.3,y:.53}; face[i]={x:.3,y:.5};
  }
  const result=eyeFeature([face]);
  assert.ok(Math.abs(result[0]-.5)<1e-10);
  assert.equal(result[1],0);
  face[145]=face[159];
  assert.equal(eyeFeature([face]),null);
});
test('prediction preserves outside-screen coordinates for invalidation', () => {
  assert.deepEqual(predict([2,3],[[1,0],[0,1],[.1,.2]]),[2.1,3.2]);
});
test('uses distinct validation targets and robust median', () => {
  assert.equal(targets.length,9);
  assert.equal(validationTargets.length,5);
  assert.deepEqual(medianFeature([[1,2],[100,200],[2,3]]),[2,3]);
});

test('motion trajectory is bounded and covers all four quadrants', async () => {
  const {trajectory,PASS_MS}=await import('./gaze.js');
  const quadrants=new Set();
  for(let t=0;t<=PASS_MS;t+=50){
    const point=trajectory(t);
    assert.ok(point.every(v=>v>=.1-1e-10&&v<=.9+1e-10));
    quadrants.add(point.map(v=>Number(v>=.5)).join(','));
  }
  assert.equal(quadrants.size,4);
});

test('blink recovery and saccades suppress invalid samples without freezing gaze', async()=>{
  const {EyeGate}=await import('./gaze.js');
  const gate=new EyeGate();
  assert.equal(gate.update([.3,.1,.3,.1],0),true);
  assert.equal(gate.update(null,20),false);
  assert.equal(gate.update([.3,.1,.3,.1],100),false);
  assert.equal(gate.update([.3,.1,.3,.1],220),true);
  assert.equal(gate.update([.9,.1,.9,.1],240),false);
  assert.equal(gate.update([.9,.1,.9,.1],400),true);
});

test('head posture beyond the calibrated range requires recalibration', async()=>{
  const {supportedHead}=await import('./gaze.js');
  const model={head_min:[0,0,.4,.4,.2,0],head_max:[.1,.1,.6,.6,.3,.1]};
  assert.equal(supportedHead([0,0,0,0,.05,.05,.5,.5,.25,.05],model),true);
  assert.equal(supportedHead([0,0,0,0,.05,.05,.9,.5,.25,.05],model),false);
});

test('natural blink and recovery do not change guidance or show a warning',async()=>{
  const {GuidanceFilter}=await import('./gaze.js');
  const guide=new GuidanceFilter();
  guide.update(null,0);const healthy=guide.update(null,600);
  for(const t of [800,900,1000])assert.deepEqual(guide.update('Olhos fechados',t),healthy);
  assert.deepEqual(guide.update(null,1100),healthy);
  assert.deepEqual(guide.update(null,1800),healthy);
});
test('persistent problem warns, text is held and recovery is stable',async()=>{
  const {GuidanceFilter}=await import('./gaze.js');
  const guide=new GuidanceFilter();
  guide.update('Sem rosto',0);
  assert.equal(guide.update('Sem rosto',1199).warning,false);
  const warning=guide.update('Sem rosto',1200);
  assert.equal(warning.warning,true);
  assert.deepEqual(guide.update('Aproxime-se',1300),warning);
  guide.update(null,1400);
  assert.deepEqual(guide.update(null,2000),warning);
  assert.equal(guide.update(null,3200).warning,false);
});

test('button readiness survives blinks but expires after persistent detection loss',async()=>{
  const {EyeReadiness}=await import('./gaze.js');
  const ready=new EyeReadiness();
  assert.equal(ready.update(null,0),false);
  assert.equal(ready.update([1,2],100),true);
  assert.equal(ready.update(null,350),true);
  assert.equal(ready.update(null,1299),true);
  assert.equal(ready.update(null,1300),false);
  assert.equal(ready.update([1,2],1400),true);
});
