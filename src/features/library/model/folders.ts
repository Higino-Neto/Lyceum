export function getTitleWithoutExtension(title: string, fileType?: string): string {
  return fileType ? title.replace(new RegExp(`\\.${fileType}$`, "i"), "") : title.replace(/\.pdf$/i, "");
}
