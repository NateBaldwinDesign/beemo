import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('public/audio', { recursive: true });
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect width="512" height="512" rx="100" fill="#65b7b0"/>
<rect x="98" y="100" width="316" height="235" rx="25" fill="#d0ffe5" stroke="#142c26" stroke-width="8"/>
<circle cx="172" cy="199" r="13"/><circle cx="340" cy="199" r="13"/>
<path d="M216 229 C222 279 290 279 296 229" fill="none" stroke="#142c26" stroke-width="9" stroke-linecap="round"/>
<path d="M155 351h34v27h27v34h-27v27h-34v-27h-27v-34h27z" fill="#ffe153" stroke="#142c26" stroke-width="5"/>
<circle cx="335" cy="402" r="30" fill="#ff3874" stroke="#142c26" stroke-width="5"/>
<path d="M307 355l20-34 20 34z" fill="#38d6e5" stroke="#142c26" stroke-width="4"/>
</svg>`;
await writeFile('public/icon.svg', icon);
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['icon-maskable', 512], ['apple-touch-icon', 180]]) {
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`public/${name}.png`);
}

// Original formant synthesis, not a recording or a model of a performer's voice.
const RATE = 22050;
const vowels = {
  a: [730, 1090, 2440],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  h: [600, 1500, 2500],
  sh: [2000, 3500, 5000],
  t: [2500, 4000, 5500],
};
function synth(segments) {
  const samples = [];
  let phase = 0;
  let noise = 123456;
  for (const [phoneme, duration, pitch, ending = phoneme] of segments) {
    const length = Math.round(RATE * duration);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const envelope = Math.min(1, t * 18, (1 - t) * 18);
      const frequency = pitch * (1 + 0.025 * Math.sin(t * Math.PI * 4));
      phase += frequency / RATE;
      let sample = 0;
      if (phoneme === 'sh' || phoneme === 'h' || phoneme === 't') {
        noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
        sample = ((noise / 4294967296) * 2 - 1) * (phoneme === 'h' ? 0.1 : 0.24);
      } else {
        const formants = vowels[phoneme].map((value, index) => value + (vowels[ending][index] - value) * t);
        for (let harmonic = 1; harmonic <= 40; harmonic++) {
          const hz = harmonic * frequency;
          const weight = formants.reduce((sum, center) => sum + Math.exp(-0.5 * ((hz - center) / 140) ** 2), 0);
          sample += Math.sin(2 * Math.PI * harmonic * phase) * weight / Math.sqrt(harmonic);
        }
        sample = Math.tanh(sample * 1.7) * 0.5;
      }
      samples.push(sample * envelope);
    }
  }
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36);
  data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  return data;
}
const clips = {
  ouch: [['a', 0.17, 290, 'u'], ['u', 0.13, 330], ['t', 0.025, 280], ['sh', 0.12, 280]],
  hey: [['h', 0.07, 300], ['e', 0.22, 315, 'i'], ['i', 0.10, 345]],
  giggle: [['h', 0.04, 360], ['a', 0.12, 370], ['h', 0.04, 390], ['a', 0.13, 400], ['h', 0.04, 360], ['i', 0.14, 380]],
};
for (const [name, segments] of Object.entries(clips)) {
  await writeFile(`public/audio/${name}.wav`, synth(segments));
}
console.log('Generated original icons and three synthetic robot utterances.');
