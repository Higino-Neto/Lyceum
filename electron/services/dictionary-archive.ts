import fs from "node:fs";
import path from "node:path";
import { extract } from "tar";
import { XzReadableStream } from "xz-decompress";

async function decompressXzToTar(sourcePath: string, targetPath: string) {
  const source = await fs.promises.readFile(sourcePath);
  const stream = new XzReadableStream(new Blob([source]).stream() as ReadableStream<Uint8Array>);
  const decompressed = await new Response(stream).arrayBuffer();
  await fs.promises.writeFile(targetPath, Buffer.from(decompressed));
}

export async function extractNestedTarArchives(directoryPath: string): Promise<number> {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  const archives = entries.filter((entry) =>
    entry.isFile() && (/\.tar$/i.test(entry.name) || /\.(tar\.xz|txz)$/i.test(entry.name)),
  );

  for (const archive of archives) {
    const archivePath = path.join(directoryPath, archive.name);
    const compressed = /\.(tar\.xz|txz)$/i.test(archive.name);
    const tarPath = compressed
      ? path.join(directoryPath, `.${archive.name.replace(/\.(tar\.xz|txz)$/i, "")}-${Date.now()}.tar`)
      : archivePath;

    try {
      if (compressed) await decompressXzToTar(archivePath, tarPath);
      await extract({
        cwd: directoryPath,
        file: tarPath,
        preserveOwner: false,
        strict: true,
      });
      await fs.promises.unlink(archivePath);
    } finally {
      if (compressed) await fs.promises.rm(tarPath, { force: true });
    }
  }

  return archives.length;
}
