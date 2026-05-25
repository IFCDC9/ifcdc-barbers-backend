/**
 * Deploy assets/ifcdc_app_icon.png (1024×1024) to web, Expo mobile assets,
 * Android mipmaps, and iOS AppIcon.appiconset.
 * Prerequisite: npm run generate:icon
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets", "ifcdc_app_icon.png");

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Missing source:", SRC, "\nRun: npm run generate:icon");
    process.exit(1);
  }

  const meta = await sharp(SRC).metadata();
  if (meta.width !== 1024 || meta.height !== 1024) {
    console.warn("Expected 1024×1024 source, got", meta.width, "×", meta.height);
  }

  /** @param {string} dst */
  /** @param {number} size */
  async function pngSquare(dst, size) {
    await fs.promises.mkdir(path.dirname(dst), { recursive: true });
    await sharp(SRC)
      .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9 })
      .toFile(dst);
  }

  /** Black canvas WxH, icon centered (contain). */
  async function splashPng(dst, w, h, iconMax) {
    await fs.promises.mkdir(path.dirname(dst), { recursive: true });
    const iconBuf = await sharp(SRC)
      .resize(iconMax, iconMax, { fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    const im = await sharp(iconBuf).metadata();
    const iw = im.width ?? iconMax;
    const ih = im.height ?? iconMax;
    const left = Math.round((w - iw) / 2);
    const top = Math.round((h - ih) / 2);
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite([{ input: iconBuf, left, top }])
      .png({ compressionLevel: 9 })
      .toFile(dst);
  }

  const clientPublic = path.join(ROOT, "client", "public");

  await pngSquare(path.join(clientPublic, "favicon-16x16.png"), 16);
  await pngSquare(path.join(clientPublic, "favicon-32x32.png"), 32);
  await pngSquare(path.join(clientPublic, "apple-touch-icon.png"), 180);
  await pngSquare(path.join(clientPublic, "icon-192.png"), 192);
  await pngSquare(path.join(clientPublic, "icon-512.png"), 512);

  const mobileAssets = path.join(ROOT, "mobile", "assets");
  await pngSquare(path.join(mobileAssets, "icon.png"), 1024);
  await pngSquare(path.join(mobileAssets, "adaptive-icon.png"), 1024);
  await splashPng(path.join(mobileAssets, "splash.png"), 1284, 2778, Math.round(Math.min(1284, 2778) * 0.42));

  const androidRoot = path.join(ROOT, "mobile", "android", "app", "src", "main", "res");
  const mipmaps = [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ];
  for (const [folder, px] of mipmaps) {
    const base = path.join(androidRoot, folder);
    await pngSquare(path.join(base, "ic_launcher.png"), px);
    await fs.promises.copyFile(path.join(base, "ic_launcher.png"), path.join(base, "ic_launcher_round.png"));
  }

  const iosSet = path.join(
    ROOT,
    "mobile",
    "ios",
    "IFCDCBarbers",
    "Images.xcassets",
    "AppIcon.appiconset"
  );

  const iosSizes = [
    [20, "icon_20.png"],
    [29, "icon_29.png"],
    [40, "icon_40.png"],
    [58, "icon_58.png"],
    [60, "icon_60.png"],
    [76, "icon_76.png"],
    [80, "icon_80.png"],
    [87, "icon_87.png"],
    [120, "icon_120.png"],
    [152, "icon_152.png"],
    [167, "icon_167.png"],
    [180, "icon_180.png"],
    [1024, "icon_1024.png"],
  ];
  for (const [px, name] of iosSizes) {
    await pngSquare(path.join(iosSet, name), px);
  }

  const contents = {
    images: [
      { size: "20x20", idiom: "iphone", filename: "icon_40.png", scale: "2x" },
      { size: "20x20", idiom: "iphone", filename: "icon_60.png", scale: "3x" },
      { size: "29x29", idiom: "iphone", filename: "icon_58.png", scale: "2x" },
      { size: "29x29", idiom: "iphone", filename: "icon_87.png", scale: "3x" },
      { size: "40x40", idiom: "iphone", filename: "icon_80.png", scale: "2x" },
      { size: "40x40", idiom: "iphone", filename: "icon_120.png", scale: "3x" },
      { size: "60x60", idiom: "iphone", filename: "icon_120.png", scale: "2x" },
      { size: "60x60", idiom: "iphone", filename: "icon_180.png", scale: "3x" },
      { size: "20x20", idiom: "ipad", filename: "icon_20.png", scale: "1x" },
      { size: "20x20", idiom: "ipad", filename: "icon_40.png", scale: "2x" },
      { size: "29x29", idiom: "ipad", filename: "icon_29.png", scale: "1x" },
      { size: "29x29", idiom: "ipad", filename: "icon_58.png", scale: "2x" },
      { size: "40x40", idiom: "ipad", filename: "icon_40.png", scale: "1x" },
      { size: "40x40", idiom: "ipad", filename: "icon_80.png", scale: "2x" },
      { size: "76x76", idiom: "ipad", filename: "icon_76.png", scale: "1x" },
      { size: "76x76", idiom: "ipad", filename: "icon_152.png", scale: "2x" },
      { size: "83.5x83.5", idiom: "ipad", filename: "icon_167.png", scale: "2x" },
      {
        size: "1024x1024",
        idiom: "ios-marketing",
        filename: "icon_1024.png",
        scale: "1x",
      },
    ],
    info: { version: 1, author: "xcode" },
  };

  await fs.promises.mkdir(iosSet, { recursive: true });
  await fs.promises.writeFile(
    path.join(iosSet, "Contents.json"),
    JSON.stringify(contents, null, 2),
    "utf8"
  );

  const manifest = {
    name: "IFCDC Barbers",
    short_name: "IFCDC Barbers",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    theme_color: "#000000",
    background_color: "#000000",
    display: "standalone",
  };
  await fs.promises.writeFile(
    path.join(clientPublic, "site.webmanifest"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log("IFCDC platform icons deployed from", SRC);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
