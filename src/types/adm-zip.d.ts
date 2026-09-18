declare module "adm-zip" {
  export interface ZipEntry {
    entryName: string;
    getData(): Buffer;
  }

  export default class AdmZip {
    constructor(filePath?: string | Buffer);
    getEntries(): ZipEntry[];
    addFile(entryName: string, content: Buffer): void;
    updateFile(entryName: string, content: Buffer): void;
    extractAllTo(targetPath: string, overwrite?: boolean): void;
    toBuffer(): Buffer;
    writeZip(targetPath: string): void;
  }
}
