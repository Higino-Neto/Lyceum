import fs from "node:fs";
import type { BookFormat, ImportInput, ImportResult, LyceumImporter } from "../schema/types";
import { readMobiBook } from "../mobi/mobiReader";
import { writeAssembledBook } from "./bookAssembly";

/** MOBI 6, KF8/AZW3 and joint files share one reader; AZW/PRC are MOBI containers. */
export class MobiImporter implements LyceumImporter {
  constructor(readonly inputFormat: BookFormat = "mobi") {}

  async import(input: ImportInput): Promise<ImportResult> {
    input.onProgress?.(0.1, "Lendo livro Kindle");
    const book = readMobiBook(await fs.promises.readFile(input.sourcePath));
    input.onProgress?.(0.6, "Montando capitulos");
    const result = await writeAssembledBook(input, this.inputFormat, book);
    input.onProgress?.(1, "Livro Kindle importado");
    return result;
  }
}
