import sharp from 'sharp';
import { writeFileSync } from 'fs';

// 512x512 SVG — EV with same gradient as EXLogo
const svgSrc = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="gE" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#67e8f9"/>
      <stop offset="50%"  stop-color="#a5b4fc"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
    <linearGradient id="gV" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#c4b5fd"/>
      <stop offset="50%"  stop-color="#e879f9"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="glowE">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glowV">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>

  <!-- Soft glow blobs -->
  <ellipse cx="170" cy="256" rx="120" ry="120" fill="rgba(96,165,250,0.18)"/>
  <ellipse cx="342" cy="256" rx="110" ry="110" fill="rgba(167,139,250,0.18)"/>

  <!-- E -->
  <text
    x="96" y="310"
    font-family="'Arial Black', 'Helvetica Neue', sans-serif"
    font-weight="900"
    font-size="240"
    letter-spacing="-8"
    fill="url(#gE)"
    filter="url(#glowE)"
  >E</text>

  <!-- M -->
  <text
    x="248" y="310"
    font-family="'Arial Black', 'Helvetica Neue', sans-serif"
    font-weight="900"
    font-size="240"
    letter-spacing="-8"
    fill="url(#gV)"
    filter="url(#glowV)"
  >M</text>

  <!-- Bottom accent line -->
  <rect x="100" y="340" width="312" height="4" rx="2"
    fill="url(#gE)" opacity="0.6"/>

  <!-- Subtitle -->
  <text
    x="256" y="392"
    font-family="'Arial', 'Helvetica Neue', sans-serif"
    font-weight="500"
    font-size="36"
    text-anchor="middle"
    letter-spacing="4"
    fill="rgba(255,255,255,0.55)"
  >Event Management</text>
</svg>`;

async function gen(size, outPath) {
  const svg = Buffer.from(svgSrc(size));
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`✓ ${outPath}`);
}

await gen(512, 'public/icon-512.png');
await gen(192, 'public/icon-192.png');
await gen(180, 'public/apple-touch-icon.png');

// Also replace the generic icon.png (used in SW)
await gen(192, 'public/icon.png');

console.log('All icons generated.');
