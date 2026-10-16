// Generates the PWA icon set from the app mark (app/icon.png).
//
// Run manually after the logo changes:
//   node scripts/generate-pwa-icons.mjs
//
// Outputs:
//   public/icons/icon-192.png        transparent, "any" purpose
//   public/icons/icon-512.png        transparent, "any" purpose
//   public/icons/maskable-192.png    brand background + padded logo, "maskable"
//   public/icons/maskable-512.png    brand background + padded logo, "maskable"
//   app/apple-icon.png               iOS home-screen icon (opaque)
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SRC = "app/icon.png";

// --primary: hsl(196 100% 47%) from app/globals.css
const BRAND = { r: 0x00, g: 0xb0, b: 0xf0, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Maskable icons must keep their content inside the safe zone (centre 80%),
// so the logo is scaled down and placed on a solid brand background.
const MASKABLE_LOGO_RATIO = 0.6;
const APPLE_LOGO_RATIO = 0.7;

async function logoBuffer(size) {
  return sharp(SRC)
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
}

async function onBrand(size, ratio, out) {
  const inner = Math.round(size * ratio);
  const logo = await logoBuffer(inner);
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  console.log(`wrote ${out} (${size}x${size})`);
}

async function transparent(size, out) {
  await sharp(SRC)
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png()
    .toFile(out);
  console.log(`wrote ${out} (${size}x${size})`);
}

await mkdir("public/icons", { recursive: true });

await transparent(192, "public/icons/icon-192.png");
await transparent(512, "public/icons/icon-512.png");
await onBrand(192, MASKABLE_LOGO_RATIO, "public/icons/maskable-192.png");
await onBrand(512, MASKABLE_LOGO_RATIO, "public/icons/maskable-512.png");
await onBrand(180, APPLE_LOGO_RATIO, "app/apple-icon.png");

console.log("done");
