const sharp = require('sharp');

const width = 600;
const height = 800;

const svgOverlay = `
<svg width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="300" y="80" font-family="sans-serif" font-size="36" font-weight="bold" fill="#0f172a" text-anchor="middle">Графік змін ВП ПАЕС</text>
  <text x="300" y="720" font-family="sans-serif" font-size="24" fill="#334155" text-anchor="middle">Відскануйте, щоб відкрити графік</text>
  <text x="300" y="760" font-family="sans-serif" font-size="22" fill="#3b82f6" text-anchor="middle">sunpp-shift-schedule.vercel.app</text>
</svg>
`;

sharp(Buffer.from(svgOverlay))
  .composite([
    { input: '/Users/maksym/.gemini/antigravity/brain/3c63d1b9-10ab-4e99-9f82-6ba932c716ac/qr-code.png', top: 150, left: 50 }
  ])
  .png()
  .toFile('/Users/maksym/.gemini/antigravity/brain/3c63d1b9-10ab-4e99-9f82-6ba932c716ac/qr-poster.png')
  .then(() => console.log('Done'))
  .catch(err => console.error(err));
