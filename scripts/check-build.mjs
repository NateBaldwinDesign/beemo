import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import path from 'node:path';

async function files(dir) {
  const result = [];
  for (const name of await readdir(dir)) {
    const file = path.join(dir, name);
    if ((await stat(file)).isDirectory()) result.push(...await files(file));
    else result.push(file);
  }
  return result;
}
const built = await files('dist');
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.start_url, '/beemo/');
assert.equal(manifest.scope, '/beemo/');
assert.equal(manifest.display, 'standalone');
assert(manifest.icons.some(icon => icon.sizes === '192x192'));
assert(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'));
const worker = await readFile('dist/sw.js', 'utf8');
for (const clip of ['ouch', 'hey', 'giggle']) {
  assert(worker.includes(`audio/${clip}.wav`), `${clip} missing from offline cache`);
  const data = await readFile(`dist/audio/${clip}.wav`);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert(data.length > 2000);
}
for (const file of built.filter(file => file.endsWith('.js') && !file.includes('workbox-'))) {
  if (file.includes('assets/index-')) assert(gzipSync(await readFile(file)).length <= 60 * 1024, 'Core JS exceeds budget');
}
let total = 0;
for (const file of built) total += gzipSync(await readFile(file)).length;
assert(total <= 1024 * 1024, 'Offline bundle exceeds 1 MB compressed');
console.log(`Manifest, offline voice coverage, and build budgets pass (${Math.ceil(total / 1024)} KB gzip total).`);
