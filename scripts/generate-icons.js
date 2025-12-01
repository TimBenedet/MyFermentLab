import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

const iconBuffer = readFileSync(join(publicDir, 'icon.png'));

// Generate PNG icons for different sizes
const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // 180x180 for iOS
];

async function generateIcons() {
  // First, trim the image to remove whitespace
  const trimmedImage = await sharp(iconBuffer)
    .trim()
    .toBuffer();

  // Then resize with padding for better appearance
  for (const { size, name } of sizes) {
    // Calculate padding (10% of size)
    const padding = Math.floor(size * 0.1);
    const contentSize = size - (padding * 2);

    await sharp(trimmedImage)
      .resize(contentSize, contentSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(join(publicDir, name));
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }
}

generateIcons()
  .then(() => console.log('\n✓ All icons generated successfully!'))
  .catch(err => {
    console.error('Error generating icons:', err);
    process.exit(1);
  });
