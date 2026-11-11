// Local descriptive analysis. Output contains ocular statistics; do not publish raw diagnostics.
import { readFile } from 'node:fs/promises';
import { signalAttempts } from '../src/signal-analysis.js';
if (!process.argv[2])
  throw new Error('Uso: node frontend/scripts/analyze-signals.mjs caminho/diagnostico.json');
const text = await readFile(process.argv[2], 'utf8');
if (Buffer.byteLength(text) > 10000000) throw new Error('Limite de 10 MB.');
console.log(JSON.stringify(signalAttempts(JSON.parse(text)), null, 2));
