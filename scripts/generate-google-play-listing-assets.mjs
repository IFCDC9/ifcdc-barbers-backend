/**
 * Play Console assets for IFCDC Barbers:
 * - mobile/store-listing/icon-512.png (512×512, opaque, from app icon)
 * - mobile/store-listing/feature-graphic.png (1024×500, ring + listing copy)
 *
 * Run: node scripts/generate-google-play-listing-assets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MOBILE = path.join(ROOT, "mobile");
const OUT_DIR = path.join(MOBILE, "store-listing");
const SOURCE_ICON = path.join(MOBILE, "assets", "icon.png");

const BG = [0, 0, 0];
const GOLD_OUT = [255, 215, 0];
const GOLD_IN = [255, 165, 0];

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

function renderRingBuffer(width, height, cx, cy, outerR, thickness) {
  const innerR = outerR - thickness;
  const aa = 1.15;
  const glowSigma = outerR * 0.35;
  const glowPeak = 0.55;

  function pixelAt(d) {
    let rgb = [...BG];

    if (d > innerR - aa) {
      const glowAmt =
        d > outerR ? glowPeak * Math.exp(-((d - outerR) ** 2) / (2 * glowSigma * glowSigma)) : 0;
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

  const buf = Buffer.alloc(width * height * 3);
  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const [r, g, b] = pixelAt(d);
      buf[i++] = r;
      buf[i++] = g;
      buf[i++] = b;
    }
  }
  return buf;
}

async function writeIcon512() {
  if (!fs.existsSync(SOURCE_ICON)) {
    console.warn("Missing", SOURCE_ICON, "— run scripts/generate-ifcdc-app-icon.mjs or add icon.png first.");
    process.exitCode = 1;
    return;
  }
  await sharp(SOURCE_ICON)
    .resize(512, 512, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "icon-512.png"));
  console.log("Wrote", path.join(OUT_DIR, "icon-512.png"));
}

async function writeFeatureGraphic() {
  const W = 1024;
  const H = 500;
  const cx = W / 2;
  const cy = H * 0.38;
  const ref = Math.min(W, H);
  const outerR = ref * 0.29;
  const thickness = ref * 0.11;

  const raw = renderRingBuffer(W, H, cx, cy, outerR, thickness);
  const ringPng = await sharp(raw, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.2" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <text x="512" y="382" text-anchor="middle" fill="#FFD700" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="34" font-weight="700" letter-spacing="0.22em" filter="url(#glow)">IFCDC BARBERS</text>
  <text x="512" y="424" text-anchor="middle" fill="#E6C875" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="17" font-weight="500" letter-spacing="0.06em" opacity="0.92">Smart Booking. Powered by AURA.</text>
</svg>`;

  const { data, info } = await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      { input: ringPng, left: 0, top: 0 },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let rgbBuf = data;
  if (info.channels === 4) {
    rgbBuf = Buffer.alloc(W * H * 3);
    let j = 0;
    for (let i = 0; i < data.length; i += 4) {
      rgbBuf[j++] = data[i];
      rgbBuf[j++] = data[i + 1];
      rgbBuf[j++] = data[i + 2];
    }
  }

  await sharp(rgbBuf, { raw: { width: W, height: H, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, "feature-graphic.png"));

  console.log("Wrote", path.join(OUT_DIR, "feature-graphic.png"));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
await writeIcon512();
if (!process.exitCode) await writeFeatureGraphic();
