import path from "node:path";

export function isSameOrNestedPath(basePath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function relocatePathWithinFolder(
  sourceFolder: string,
  destinationFolder: string,
  documentPath: string,
): string | null {
  if (!isSameOrNestedPath(sourceFolder, documentPath)) return null;
  return path.join(destinationFolder, path.relative(sourceFolder, documentPath));
}
