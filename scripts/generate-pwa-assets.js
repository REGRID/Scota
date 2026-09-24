const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const srcPath = "C:/Users/WIG/.gemini/antigravity-ide/brain/4fc71c14-191c-415a-8270-69f6a467f2a6/.user_uploaded/media_1790214963351.png";
const publicDir = path.resolve(__dirname, "../public");

async function generatePwaAssets() {
  console.log("Loading source image:", srcPath);
  const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;

  // 1. Precise background transparency extraction with anti-aliasing
  const transparentBuffer = Buffer.alloc(width * height * 4);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const diffR = 255 - r;
    const diffG = 255 - g;
    const diffB = 255 - b;
    const maxDiff = Math.max(diffR, diffG, diffB);

    if (maxDiff <= 4) {
      transparentBuffer[i] = 0;
      transparentBuffer[i + 1] = 0;
      transparentBuffer[i + 2] = 0;
      transparentBuffer[i + 3] = 0;
    } else {
      let alpha = Math.min(255, Math.round((maxDiff / 190) * 255));
      if (maxDiff > 135) alpha = 255;

      const aNorm = alpha / 255;
      const recR = Math.max(0, Math.min(255, Math.round((r - (1 - aNorm) * 255) / aNorm)));
      const recG = Math.max(0, Math.min(255, Math.round((g - (1 - aNorm) * 255) / aNorm)));
      const recB = Math.max(0, Math.min(255, Math.round((b - (1 - aNorm) * 255) / aNorm)));

      transparentBuffer[i] = recR;
      transparentBuffer[i + 1] = recG;
      transparentBuffer[i + 2] = recB;
      transparentBuffer[i + 3] = alpha;
    }
  }

  // Trim transparent edges so the emblem can be precisely positioned
  const rawTransparent = sharp(transparentBuffer, { raw: { width, height, channels: 4 } });
  const trimmedBuffer = await rawTransparent.trim().png().toBuffer();
  const trimmedMeta = await sharp(trimmedBuffer).metadata();
  console.log(`Trimmed emblem: ${trimmedMeta.width}x${trimmedMeta.height}`);

  // 2. Generate 512x512 transparent icon (for icon-512.png & scota-icon.png)
  // Emblem occupies ~84% of canvas (430px) for optical balance
  const targetEmblemSize512 = 430;
  const resizedFor512 = await sharp(trimmedBuffer)
    .resize({
      width: targetEmblemSize512,
      height: targetEmblemSize512,
      fit: "inside",
      kernel: "lanczos3"
    })
    .toBuffer();

  const icon512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resizedFor512, gravity: "center" }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, "icon-512.png"), icon512);
  fs.writeFileSync(path.join(publicDir, "scota-icon.png"), icon512);
  console.log("Generated: public/icon-512.png and public/scota-icon.png");

  // 3. Generate 192x192 transparent icon (for icon-192.png)
  const icon192 = await sharp(icon512)
    .resize(192, 192, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, "icon-192.png"), icon192);
  console.log("Generated: public/icon-192.png");

  // 4. Generate 512x512 MASKABLE icon (for Android adaptive icons)
  // Maskable icon requires safe zone padding: emblem must stay within the inner 80% circle
  // 512 * 0.70 = ~358px max size
  const maskableEmblemSize = 358;
  const resizedForMaskable = await sharp(trimmedBuffer)
    .resize({
      width: maskableEmblemSize,
      height: maskableEmblemSize,
      fit: "inside",
      kernel: "lanczos3"
    })
    .toBuffer();

  const maskableIcon = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // #0f172a Slate-900 (Scota Brand Dark)
    }
  })
    .composite([{ input: resizedForMaskable, gravity: "center" }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, "maskable-icon.png"), maskableIcon);
  console.log("Generated: public/maskable-icon.png (Android adaptive safe-zone)");

  // 5. Generate 180x180 Apple Touch Icon (for iOS Homescreen)
  // iOS homescreen requires solid background (#0f172a) with ~130px emblem
  const appleEmblemSize = 130;
  const resizedForApple = await sharp(trimmedBuffer)
    .resize({
      width: appleEmblemSize,
      height: appleEmblemSize,
      fit: "inside",
      kernel: "lanczos3"
    })
    .toBuffer();

  const appleTouchIcon = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // #0f172a
    }
  })
    .composite([{ input: resizedForApple, gravity: "center" }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), appleTouchIcon);
  console.log("Generated: public/apple-touch-icon.png (iOS homescreen)");

  // 6. Generate 32x32 Favicon PNG
  const favicon32 = await sharp(trimmedBuffer)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, "favicon.png"), favicon32);
  console.log("Generated: public/favicon.png");

  // 7. Generate Favicon ICO (ICO container with 32x32 PNG inside or 16+32+48)
  // A modern .ico file can wrap a 32x32 PNG directly
  // Create standard ICO header for 1 image:
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // image type: 1 = icon
  icoHeader.writeUInt16LE(1, 4); // count of images: 1

  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(32, 0); // width 32
  icoEntry.writeUInt8(32, 1); // height 32
  icoEntry.writeUInt8(0, 2);  // color palette: 0 = no palette
  icoEntry.writeUInt8(0, 3);  // reserved
  icoEntry.writeUInt16LE(1, 4); // color planes
  icoEntry.writeUInt16LE(32, 6); // bits per pixel: 32
  icoEntry.writeUInt32LE(favicon32.length, 8); // size of image data in bytes
  icoEntry.writeUInt32LE(22, 12); // offset of image data (6 header + 16 entry = 22)

  const faviconIco = Buffer.concat([icoHeader, icoEntry, favicon32]);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), faviconIco);
  console.log("Generated: public/favicon.ico");

  console.log("All PWA assets successfully created!");
}

generatePwaAssets().catch(console.error);
