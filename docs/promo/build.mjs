// Generates Chrome Web Store promo tiles as SVG (crisp vector text + embedded
// logo), then they are rasterized to PNG by build.sh.
//
//   Small promo tile  : 440 x 280
//   Marquee promo tile: 1400 x 560
//
// qlmanage (the only rasterizer on macOS without extra deps) always emits a
// SQUARE thumbnail. So we draw each tile on a square canvas with the artwork
// centered in the middle band, render the square, then center-crop down to the
// real tile height. That keeps the crop deterministic regardless of how Quick
// Look positions content.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const iconB64 = readFileSync(
  resolve(here, "../../static/icons/icon128.png"),
).toString("base64");
const LOGO = `data:image/png;base64,${iconB64}`;

const FONT = "-apple-system, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";
const NAME = "Better GitHub";

const defs = (side, glowX, glowY, glowR) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1117"/>
      <stop offset="1" stop-color="#161b22"/>
    </linearGradient>
    <radialGradient id="glow" cx="${glowX}" cy="${glowY}" r="${glowR}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2ea043" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#2ea043" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${side}" height="${side}" fill="url(#bg)"/>
  <rect width="${side}" height="${side}" fill="url(#glow)"/>`;

// ---- Marquee: 1400 x 560 (square canvas 1400; band y = 420..980) -----------
const mY = (420 - 560) / 2; // shift from tile-local coords into the band
const marquee = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400">
  ${defs(1400, 1180, 700, 640)}
  <image href="${LOGO}" x="130" y="${610}" width="180" height="180"/>
  <g font-family="${FONT}">
    <text x="350" y="${690}" font-size="92" font-weight="800" fill="#ffffff" letter-spacing="-2">${NAME}</text>
    <text x="354" y="${752}" font-size="34" font-weight="400" fill="#8b949e">Improve usability of GitHub PR, issue &amp; other pages</text>
    <rect x="356" y="${780}" width="116" height="6" rx="3" fill="#2ea043"/>
  </g>
</svg>`;

// ---- Small: 440 x 280 (square canvas 440; band y = 80..360) ----------------
const small = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="440" viewBox="0 0 440 440">
  ${defs(440, 220, 150, 300)}
  <image href="${LOGO}" x="172" y="${124}" width="96" height="96"/>
  <g font-family="${FONT}" text-anchor="middle">
    <text x="220" y="${276}" font-size="40" font-weight="800" fill="#ffffff" letter-spacing="-1">${NAME}</text>
    <rect x="186" y="${294}" width="68" height="5" rx="2.5" fill="#2ea043"/>
    <text x="220" y="${328}" font-size="16" font-weight="400" fill="#8b949e">Improve GitHub PR &amp; issue pages</text>
  </g>
</svg>`;

void mY;
writeFileSync(resolve(here, "marquee.svg"), marquee);
writeFileSync(resolve(here, "small.svg"), small);
console.log("wrote marquee.svg (1400 sq) and small.svg (440 sq)");
