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
