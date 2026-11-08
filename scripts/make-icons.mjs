import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = new URL('../public/icons/', import.meta.url);
const file = (name) => fileURLToPath(new URL(name, dir));
const svg = await readFile(file('icon.svg'));
const render = (size) => sharp(svg, { density: 1024 }).resize(size, size).png();

for (const [name, size] of [['apple-touch-icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await render(size).toFile(file(name));
}

// Maskable: icon at 80% inside a full-bleed background so Android/iOS masks never crop the eye.
const inner = await render(410).toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2F4A24' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(file('icon-maskable-512.png'));

console.log('icons written to public/icons/');
