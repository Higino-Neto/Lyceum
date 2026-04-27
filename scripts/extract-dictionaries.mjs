import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import AdmZip from "adm-zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEVEN_ZIP = "C:\\Program Files\\7-Zip\\7z.exe";
const DOWNLOAD_DIR = "C:\\Users\\tawlt\\Downloads\\freedict-dictionaries";
const EXTRACT_DIR = "C:\\Users\\tawlt\\Downloads\\freedict-extracted";

const DICTIONARIES = [
  { id: "eng-spa", name: "English → Spanish" },
  { id: "eng-por", name: "English → Portuguese" },
  { id: "eng-fra", name: "English → French" },
  { id: "eng-deu", name: "English → German" },
  { id: "eng-ita", name: "English → Italian" },
  { id: "eng-zho", name: "English → Chinese" },
  { id: "eng-jpn", name: "English → Japanese" },
  { id: "eng-rus", name: "English → Russian" },
];

if (!fs.existsSync(EXTRACT_DIR)) {
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
}

function run7z(args) {
  execSync(`"${SEVEN_ZIP}" ${args}`, { cwd: DOWNLOAD_DIR });
}

async function main() {
  console.log("Extracting with 7-Zip and converting to ZIP...");
  console.log(`Source: ${DOWNLOAD_DIR}`);
  console.log(`Temp: ${EXTRACT_DIR}`);
  
  for (const dict of DICTIONARIES) {
    const tarPath = path.join(DOWNLOAD_DIR, `${dict.id}.tar.xz`);
    const zipPath = path.join(DOWNLOAD_DIR, `${dict.id}.zip`);
    const dictDir = path.join(EXTRACT_DIR, dict.id);
    
    if (fs.existsSync(dictDir)) {
      fs.rmSync(dictDir, { recursive: true, force: true });
    }
    
    try {
      // Extract .tar.xz (7z handles xz compression)
      console.log(`Extracting ${dict.id}...`);
      fs.mkdirSync(dictDir, { recursive: true });
      run7z(`x -y "${tarPath}" -o"${dictDir}"`);
      
      // Create ZIP
      console.log(`Creating ZIP for ${dict.id}...`);
      run7z(`a -y "${zipPath}" "${dictDir}\\*"`);
      
      console.log(`Converted ${dict.name}`);
    } catch (error) {
      console.error(`Error processing ${dict.id}:`, error.message);
    }
  }
  
  console.log("\n--- Conversion complete ---");
  console.log("ZIP files saved to:", DOWNLOAD_DIR);
}

main().catch(console.error);