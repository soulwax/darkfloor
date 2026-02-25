// File: scripts/generate-og-image.js

import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const WIDTH = 1200;
const HEIGHT = 630;

const TITLE = "Starchild Music";
const SUBTITLE = "Modern music streaming and discovery platform";

const BG_COLOR = "#0b1118";
const TITLE_COLOR = "#f5f1e8";
const SUBTITLE_COLOR = "#a5afbf";
const ACCENT_COLOR = "#f4b266";

async function generateOgImage() {
  console.log("Generating OG image...");

  const logoPath = join(rootDir, "apps", "web", "public", "emily-the-strange.png");
  const logoBuffer = readFileSync(logoPath);

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoSize = 280;
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const logoY = 80;
  const titleY = logoY + logoSize + 60;
  const subtitleY = titleY + 70;

  const svgOverlay = `
    <svg width="${WIDTH}" height="${HEIGHT}">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&amp;display=swap');
        </style>
        <linearGradient id="titleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${TITLE_COLOR};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${ACCENT_COLOR};stop-opacity:1" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <text
        x="${WIDTH / 2}"
        y="${titleY}"
        text-anchor="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
        font-size="72"
        font-weight="700"
        fill="url(#titleGradient)"
        filter="url(#glow)"
      >${TITLE}</text>

      <text
        x="${WIDTH / 2}"
        y="${subtitleY}"
        text-anchor="middle"
        font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
        font-size="28"
        font-weight="400"
        fill="${SUBTITLE_COLOR}"
      >${SUBTITLE}</text>

      <line
        x1="${WIDTH / 2 - 60}"
        y1="${subtitleY + 50}"
        x2="${WIDTH / 2 + 60}"
        y2="${subtitleY + 50}"
        stroke="${ACCENT_COLOR}"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.6"
      />
    </svg>
  `;

  const background = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .png()
    .toBuffer();

  const logoX = Math.round((WIDTH - logoSize) / 2);

  const result = await sharp(background)
    .composite([
      {
        input: resizedLogo,
        top: logoY,
        left: logoX,
      },
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(join(rootDir, "apps", "web", "public", "og-image.png"));

  console.log("OG image generated: apps/web/public/og-image.png");
  console.log(`Size: ${result.width}x${result.height}`);
}

generateOgImage().catch(console.error);
