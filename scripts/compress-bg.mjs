import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const src = join(publicDir, 'mercury-office.jpg');

await sharp(src)
  .resize({ width: 1280, withoutEnlargement: true })
  .webp({ quality: 72 })
  .toFile(join(publicDir, 'mercury-office.webp'));

const meta = await sharp(join(publicDir, 'mercury-office.webp')).metadata();
console.log(`mercury-office.webp: ${meta.width}x${meta.height}`);
