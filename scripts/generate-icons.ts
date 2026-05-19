import sharp from 'sharp';
import { join } from 'node:path';

const sizes = [192, 512];
const outDir = join(process.cwd(), 'public');

async function main() {
  for (const size of sizes) {
    const r = Math.round(size * 0.15); // border-radius
    const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#09090b"/>
  <text x="${size/2}" y="${size*0.68}" font-family="Georgia,serif" font-size="${size*0.44}" font-weight="bold" text-anchor="middle" fill="#10b981">DT</text>
</svg>`);

    await sharp(svg).png().toFile(join(outDir, `icon-${size}.png`));
    console.log(`icon-${size}.png done`);
  }

  // maskable icon (без скруглений, с padding)
  const mSize = 512;
  const svgMaskable = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mSize} ${mSize}">
  <rect width="${mSize}" height="${mSize}" fill="#09090b"/>
  <text x="${mSize/2}" y="${mSize*0.68}" font-family="Georgia,serif" font-size="${mSize*0.38}" font-weight="bold" text-anchor="middle" fill="#10b981">DT</text>
</svg>`);
  await sharp(svgMaskable).png().toFile(join(outDir, 'icon-maskable.png'));
  console.log('icon-maskable.png done');
}

main().catch((e) => { console.error(e); process.exit(1); });
