import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOWNLOAD_DIR = "C:\\Users\\tawlt\\Downloads\\freedict-dictionaries";

const DICTIONARIES = [
  {
    id: "eng-spa",
    name: "English → Spanish",
    url: "https://download.freedict.org/dictionaries/eng-spa/2025.11.23/freedict-eng-spa-2025.11.23.stardict.tar.xz",
  },
  {
    id: "eng-por",
    name: "English → Portuguese",
    url: "https://download.freedict.org/dictionaries/eng-por/0.3/freedict-eng-por-0.3.stardict.tar.xz",
  },
  {
    id: "eng-fra",
    name: "English → French",
    url: "https://download.freedict.org/dictionaries/eng-fra/0.1.6/freedict-eng-fra-0.1.6.stardict.tar.xz",
  },
  {
    id: "eng-deu",
    name: "English → German",
    url: "https://download.freedict.org/dictionaries/eng-deu/1.9-fd1/freedict-eng-deu-1.9-fd1.stardict.tar.xz",
  },
  {
    id: "eng-ita",
    name: "English → Italian",
    url: "https://download.freedict.org/dictionaries/eng-ita/2025.11.23/freedict-eng-ita-2025.11.23.stardict.tar.xz",
  },
  {
    id: "eng-zho",
    name: "English → Chinese",
    url: "https://download.freedict.org/dictionaries/eng-zho/2025.11.23/freedict-eng-zho-2025.11.23.stardict.tar.xz",
  },
  {
    id: "eng-jpn",
    name: "English → Japanese",
    url: "https://download.freedict.org/dictionaries/eng-jpn/2025.11.23/freedict-eng-jpn-2025.11.23.stardict.tar.xz",
  },
  {
    id: "eng-rus",
    name: "English → Russian",
    url: "https://download.freedict.org/dictionaries/eng-rus/2025.11.23/freedict-eng-rus-2025.11.23.stardict.tar.xz",
  },
];

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function downloadFile(url, destPath) {
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const fileStream = createWriteStream(destPath);
  await pipeline(Readable.fromWeb(response.body), fileStream);
  console.log(`Downloaded to ${destPath}`);
}

async function main() {
  console.log("Starting FreeDict download script...");
  console.log(`Download directory: ${DOWNLOAD_DIR}`);

  for (const dict of DICTIONARIES) {
    const tarPath = path.join(DOWNLOAD_DIR, `${dict.id}.tar.xz`);

    if (fs.existsSync(tarPath)) {
      console.log(`Skip ${dict.id} - already exists`);
      continue;
    }

    try {
      await downloadFile(dict.url, tarPath);
      console.log(`Downloaded ${dict.name} (${dict.id})`);
    } catch (error) {
      console.error(`Error downloading ${dict.id}:`, error);
    }
  }

  console.log("\n--- Download complete ---");
  console.log("Files saved to:", DOWNLOAD_DIR);
  console.log("\nTo extract .tar.xz files, use 7-Zip or run:");
  console.log("  xz -d *.tar.xz");
  console.log("  tar -xf *.tar");
}

main().catch(console.error);