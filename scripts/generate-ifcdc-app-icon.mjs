/**
 * Generates assets/ifcdc_app_icon.png — 1024×1024, opaque PNG, black background.
 * Regenerate: node scripts/generate-ifcdc-app-icon.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "assets", "ifcdc_app_icon.png");

const W = 1024;
const BG = [0, 0, 0];
const GOLD_OUT = [255, 215, 0]; // #FFD700
const GOLD_IN = [255, 165, 0]; // #FFA500

const cx = (W - 1) / 2;
const cy = (W - 1) / 2;
const thickness = W * 0.12;
const outerR = W * 0.3145;
const innerR = outerR - thickness;
/** Antialias band (~1px at 1x; scales clean at export) */
const aa = 1.15;
/** Outer glow: ~50% peak mix, medium spread */
const GLOW_SIGMA = 46;
const GLOW_PEAK = 0.5;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRGB(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function blendOver(bg, fg, a) {
  const t = Math.max(0, Math.min(1, a));
  return [lerp(bg[0], fg[0], t), lerp(bg[1], fg[1], t), lerp(bg[2], fg[2], t)];
}

function pixelAt(d) {
  let rgb = [...BG];

  if (d > innerR - aa) {
    const glowAmt =
      d > outerR ? GLOW_PEAK * Math.exp(-((d - outerR) ** 2) / (2 * GLOW_SIGMA * GLOW_SIGMA)) : 0;
    if (glowAmt > 1e-4) {
      rgb = blendOver(rgb, GOLD_OUT, glowAmt);
    }
  }

  const ringIn = smoothstep(innerR - aa, innerR + aa, d);
  const ringOut = 1 - smoothstep(outerR - aa, outerR + aa, d);
  const ringAlpha = ringIn * ringOut;

  if (ringAlpha > 1e-4) {
    const denom = outerR - innerR;
    const tRing = denom > 1e-6 ? Math.max(0, Math.min(1, (d - innerR) / denom)) : 0;
    const ringCol = lerpRGB(GOLD_IN, GOLD_OUT, tRing);
    rgb = blendOver(rgb, ringCol, ringAlpha);
  }

  const innerMask = 1 - smoothstep(innerR - aa, innerR + aa, d);
  if (innerMask > 1e-4) {
    const t = innerR > 1e-6 ? d / innerR : 0;
    let innerCol = lerpRGB([5, 5, 6], [34, 34, 38], smoothstep(0, 1, t));
    const rimWarm = smoothstep(innerR * 0.78, innerR * 0.98, d) * 0.11;
    innerCol = blendOver(innerCol, [42, 36, 22], rimWarm);
    rgb = blendOver(rgb, innerCol, innerMask);
  }

  return rgb;
}

const buf = Buffer.alloc(W * W * 3);
let i = 0;
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    const [r, g, b] = pixelAt(d);
    buf[i++] = r;
    buf[i++] = g;
    buf[i++] = b;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

await sharp(buf, { raw: { width: W, height: W, channels: 3 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT);

console.log("Wrote", OUT, `(${W}×${W}, ring thickness ${thickness.toFixed(1)}px)`);
