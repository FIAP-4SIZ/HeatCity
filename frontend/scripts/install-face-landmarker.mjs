import { mkdir, writeFile, rename } from 'node:fs/promises';
const target = new URL('../public/mediapipe/face_landmarker.task', import.meta.url);
const url =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000000 || bytes.subarray(0, 2).toString() !== 'PK')
    throw new Error('Arquivo de modelo inválido.');
  await mkdir(new URL('../public/mediapipe/', import.meta.url), { recursive: true });
  await writeFile(new URL(`${target.href}.tmp`), bytes);
  await rename(new URL(`${target.href}.tmp`), target);
  console.log('Modelo oficial Face Landmarker instalado. Reinicie a câmera e recalibre.');
} catch (error) {
  console.error(
    `Não foi possível instalar Face Landmarker: ${error.message}. O detector anterior continua disponível.`,
  );
  process.exitCode = 1;
}
