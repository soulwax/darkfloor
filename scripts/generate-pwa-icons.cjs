// File: scripts/generate-pwa-icons.cjs

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceIcon = path.join(__dirname, '..', 'public', 'emily-the-strange-raw.png');
const outputDir = path.join(__dirname, '..', 'public');

const sizes = [192, 512];

async function generateIcons() {
  console.log('Generating PWA icons from Emily the Strange...');

  if (!fs.existsSync(sourceIcon)) {
    console.error('Source icon not found:', sourceIcon);
    process.exit(1);
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    try {
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${size}x${size} icon`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ Failed to generate ${size}x${size} icon:`, error.message);
      } else {
        console.error(`✗ Failed to generate ${size}x${size} icon: Unknown error`, error);
      }
    }
  }

  console.log('Done!');
}

generateIcons().catch(console.error);
