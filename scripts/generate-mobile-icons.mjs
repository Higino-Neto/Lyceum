import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const logo = readFileSync(path.join(root, "public", "logo.svg"));
const background = "#09090b";
const androidRes = path.join(root, "android", "app", "src", "main", "res");
const iosAssets = path.join(root, "ios", "App", "App", "Assets.xcassets");

async function brandedSquare(size, markSize, transparent = false) {
  const mark = await sharp(logo).resize(markSize, markSize).png().toBuffer();
  const image = sharp({
    create: {
      width: size,
      height: size,
      channels: transparent ? 4 : 3,
      background: transparent ? "#00000000" : background,
    },
  }).composite([{ input: mark, left: Math.floor((size - markSize) / 2), top: Math.floor((size - markSize) / 2) }]);
  return (transparent ? image : image.flatten({ background }).removeAlpha()).png().toBuffer();
}

async function splash(width, height) {
  const markSize = Math.round(Math.min(width, height) * 0.34);
  const mark = await sharp(logo).resize(markSize, markSize).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background } })
    .composite([{ input: mark, left: Math.floor((width - markSize) / 2), top: Math.floor((height - markSize) / 2) }])
    .png().toBuffer();
}

export async function generateMobileIcons(target = "all") {
  if (target !== "ios") {
    for (const [density, iconSize, foregroundSize] of [
      ["mdpi", 48, 108], ["hdpi", 72, 162], ["xhdpi", 96, 216],
      ["xxhdpi", 144, 324], ["xxxhdpi", 192, 432],
    ]) {
      const dir = path.join(androidRes, `mipmap-${density}`);
      const icon = await brandedSquare(iconSize, Math.round(iconSize * 0.57));
      writeFileSync(path.join(dir, "ic_launcher.png"), icon);
      writeFileSync(path.join(dir, "ic_launcher_round.png"), icon);
      writeFileSync(path.join(dir, "ic_launcher_foreground.png"), await brandedSquare(foregroundSize, Math.round(foregroundSize * 0.53), true));
    }
    writeFileSync(path.join(androidRes, "values", "ic_launcher_background.xml"),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${background.toUpperCase()}</color>\n</resources>\n`);
    for (const [variant, width, height] of [
      ["drawable", 480, 320],
      ["drawable-land-mdpi", 480, 320], ["drawable-land-hdpi", 800, 480],
      ["drawable-land-xhdpi", 1280, 720], ["drawable-land-xxhdpi", 1600, 960],
      ["drawable-land-xxxhdpi", 1920, 1280],
      ["drawable-port-mdpi", 320, 480], ["drawable-port-hdpi", 480, 800],
      ["drawable-port-xhdpi", 720, 1280], ["drawable-port-xxhdpi", 960, 1600],
      ["drawable-port-xxxhdpi", 1280, 1920],
    ]) {
      writeFileSync(path.join(androidRes, variant, "splash.png"), await splash(width, height));
    }
  }

  if (target !== "android") {
    writeFileSync(path.join(iosAssets, "AppIcon.appiconset", "AppIcon-512@2x.png"), await brandedSquare(1024, 580));
    const iosSplash = await splash(2732, 2732);
    for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
      writeFileSync(path.join(iosAssets, "Splash.imageset", name), iosSplash);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.url.slice(7))) {
  await generateMobileIcons((process.env.MOBILE_NATIVE_TARGET || "all").toLowerCase());
  console.log("Generated Lyceum native icons and splash screens.");
}
