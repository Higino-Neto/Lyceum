const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const projectRoot = path.join(__dirname, '..');
const inputSvg = path.join(projectRoot, 'public', 'logo.svg');
const outputDir = path.join(projectRoot, 'build');

async function generateIcons() {
  const svgBuffer = fs.readFileSync(inputSvg);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon_${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon_${size}.png`);
  }

  // Generate ICO file (using 256x256 as base)
  const icoPath = path.join(outputDir, 'icon.ico');
  
  // For ICO, we need to create a proper multi-resolution ICO file
  // We'll use a simple approach: use 256x256 PNG as the main icon
  // A proper ICO would need multiple sizes embedded, but electron-builder can work with this
  
  const png256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer();
  
  // Create a simple ICO header + PNG data (works for modern Windows)
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type (1 = ICO)
  icoHeader.writeUInt16LE(1, 4); // Number of images

  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(0, 0);  // Width (0 = 256)
  icoEntry.writeUInt8(0, 1);  // Height (0 = 256)
  icoEntry.writeUInt8(0, 2);  // Color palette
  icoEntry.writeUInt8(0, 3);  // Reserved
  icoEntry.writeUInt16LE(1, 4);  // Color planes
  icoEntry.writeUInt16LE(32, 6); // Bits per pixel
  icoEntry.writeUInt32LE(png256.length, 8);  // Image size
  icoEntry.writeUInt32LE(22, 12);  // Offset to image data

  const icoFile = Buffer.concat([icoHeader, icoEntry, png256]);
  fs.writeFileSync(icoPath, icoFile);
  
  console.log('Generated: icon.ico');
  console.log('Done!');
}

generateIcons().catch(console.error);