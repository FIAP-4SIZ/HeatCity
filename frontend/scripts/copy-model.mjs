import { mkdir, readdir, copyFile } from 'node:fs/promises';
const source = new URL('../node_modules/@mediapipe/face_mesh/', import.meta.url);
const target = new URL('../public/mediapipe/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of await readdir(source)) {
  if (/\.(js|wasm|data|binarypb|tflite)$/.test(name)) {
    await copyFile(new URL(name, source), new URL(name, target));
  }
}
const tasksSource = new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url);
const tasksTarget = new URL('../public/mediapipe/tasks/', import.meta.url);
await mkdir(tasksTarget, { recursive: true });
for (const name of await readdir(tasksSource)) {
  if (/\.(js|wasm)$/.test(name))
    await copyFile(new URL(name, tasksSource), new URL(name, tasksTarget));
}
// Bundled model supplied for this project, independent of external downloads.
const bundledModel = new URL('../models/face_landmarker.task', import.meta.url);
const { readFile } = await import('node:fs/promises');
const { createHash } = await import('node:crypto');
const modelBytes = await readFile(bundledModel);
if (
  createHash('sha256').update(modelBytes).digest('hex') !==
  '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
)
  throw new Error('Modelo Face Landmarker alterado: verifique a origem antes de atualizar o hash.');
await copyFile(bundledModel, new URL('face_landmarker.task', target));
