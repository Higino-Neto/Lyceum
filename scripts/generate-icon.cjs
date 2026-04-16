const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const projectRoot = path.join(__dirname, '..');
const outputDir = path.join(projectRoot, 'build');

const iconFiles = [
  { input: 'logo.svg', output: 'icon' },
  { input: 'pdf-icon.svg', output: 'pdf-icon' },
  { input: 'epub-icon.svg', output: 'epub-icon' }
];

async function generateIcon(inputSvg, outputName) {
  const inputPath = path.join(projectRoot, 'public', inputSvg);
  const svgBuffer = fs.readFileSync(inputPath);
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `${outputName}_${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
  }
  
  const icoPath = path.join(outputDir, `${outputName}.ico`);
  const png256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer();
  
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);
  icoHeader.writeUInt16LE(1, 2);
  icoHeader.writeUInt16LE(1, 4);

  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(0, 0);
  icoEntry.writeUInt8(0, 1);
  icoEntry.writeUInt8(0, 2);
  icoEntry.writeUInt8(0, 3);
  icoEntry.writeUInt16LE(1, 4);
  icoEntry.writeUInt16LE(32, 6);
  icoEntry.writeUInt32LE(png256.length, 8);
  icoEntry.writeUInt32LE(22, 12);

  const icoFile = Buffer.concat([icoHeader, icoEntry, png256]);
  fs.writeFileSync(icoPath, icoFile);
  
  console.log(`Generated: ${outputName}.ico`);
}

async function generateIcons() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const icon of iconFiles) {
    await generateIcon(icon.input, icon.output);
  }
  
  console.log('All icons generated!');
}

generateIcons().catch(console.error);