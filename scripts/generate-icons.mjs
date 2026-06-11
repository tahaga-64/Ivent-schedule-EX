// public/favicon.svg（静止 EX ロゴ）から PWA / favicon / apple-touch アイコンの PNG を生成する。
// 使い方: npm run icons   （sharp が必要）
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public', 'favicon.svg'));

const targets = [
  { file: 'icon.png', size: 192 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(root, 'public', file));
  console.log(`generated public/${file} (${size}x${size})`);
}
