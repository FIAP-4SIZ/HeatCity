import { mkdir, readdir, copyFile } from 'node:fs/promises';
const source = new URL('../node_modules/@mediapipe/face_mesh/', import.meta.url);
const target = new URL('../public/mediapipe/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of await readdir(source)) {
  if (/\.(js|wasm|data|binarypb|tflite)$/.test(name)) {
    await copyFile(new URL(name, source), new URL(name, target));
  }
}
