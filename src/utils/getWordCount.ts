import { PluginRegistry } from "@embedpdf/react-pdf-viewer";

export default async function getWordCount(
  registry: PluginRegistry,
  from: number,
  to: number,
): Promise<number> {
  if (!registry) return;
  const engine = registry.getEngine();
  if (!engine) return;

  const documentManager = registry.getPlugin("document-manager").provides();
  const document = documentManager?.getActiveDocument();
  if (!document) return 0;

  const pageRange = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const text = await engine.extractText(document, pageRange).toPromise();

  return text.trim().split(/\s+/).filter(Boolean).length;
}
