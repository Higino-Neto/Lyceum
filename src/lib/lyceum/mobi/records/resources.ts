import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type sharpType from "sharp";
import { textualResourcePath } from "../../package/paths";
import type { LyceumPackage, LyceumTextualResource } from "../../schema/types";
import { resolveKindleFirmwareProfile, type KindleFirmwareProfile } from "../../kindle/firmwareQuirks";

type SharpFactory = typeof sharpType;
const require = createRequire(import.meta.url);
let sharpFactoryPromise: Promise<SharpFactory> | null = null;

export interface KindleImagePreparation {
  pkg: LyceumPackage;
  convertedImageCount: number;
  resizedImageCount: number;
  thumbnailGenerated: boolean;
  firmwareProfile: string;
  warnings: string[];
}

async function getSharp(): Promise<SharpFactory> {
  sharpFactoryPromise ||= Promise.resolve(require("sharp") as SharpFactory);
  return sharpFactoryPromise;
}

export function hydrateTextualResources(pkg: LyceumPackage): LyceumPackage {
  if (!pkg.textual?.resources?.length) return pkg;

  return {
    ...pkg,
    textual: {
      ...pkg.textual,
      resources: pkg.textual.resources.map((resource) => {
        if (resource.data) return resource;
        try {
          return {
            ...resource,
            data: fs.readFileSync(textualResourcePath(pkg.rootPath, resource.href)),
          };
        } catch {
          return resource;
        }
      }),
    },
  };
}

function resourceBytes(resource: LyceumTextualResource): Uint8Array | null {
  if (resource.data instanceof ArrayBuffer) return new Uint8Array(resource.data);
  if (resource.data) return new Uint8Array(resource.data.buffer, resource.data.byteOffset, resource.data.byteLength);
  return null;
}

function hasManifestProperty(resource: LyceumTextualResource, property: string) {
  return Boolean(resource.properties?.split(/\s+/).includes(property));
}

function appendManifestProperty(properties: string | undefined, property: string) {
  const parts = (properties || "").split(/\s+/).filter(Boolean);
  if (!parts.includes(property)) parts.push(property);
  return parts.join(" ");
}

function thumbnailHrefFor(resource: LyceumTextualResource) {
  const parsed = path.posix.parse(resource.href.replace(/\\/g, "/"));
  const directory = parsed.dir ? `${parsed.dir}/` : "resources/";
  const baseName = parsed.name || resource.id || "cover";
  return `${directory}${baseName}-thumbnail.jpg`;
}

async function convertImageForKindle(resource: LyceumTextualResource, profile: KindleFirmwareProfile): Promise<{
  resource: LyceumTextualResource;
  converted: boolean;
  resized: boolean;
}> {
  const data = resourceBytes(resource);
  if (!data || data.length === 0 || !resource.mediaType.startsWith("image/")) {
    return { resource, converted: false, resized: false };
  }

  const normalizedType = resource.mediaType.toLowerCase();
  const sharp = await getSharp();
  const image = sharp(Buffer.from(data), { animated: normalizedType === "image/gif" });
  const metadata = await image.metadata();
  const longestEdge = Math.max(metadata.width || 0, metadata.height || 0);
  const shouldResize = longestEdge > profile.maxImageEdge || data.length > profile.maxImageBytes;
  const shouldConvert = !profile.safeImageTypes.has(normalizedType);

  if (!shouldResize && !shouldConvert) {
    return { resource, converted: false, resized: false };
  }

  const base = sharp(Buffer.from(data), { animated: false }).rotate();
  const pipeline = shouldResize
    ? base.resize({
      width: profile.maxImageEdge,
      height: profile.maxImageEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    : base;
  const hasAlpha = Boolean(metadata.hasAlpha);
  const output = hasAlpha
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
    : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  return {
    resource: {
      ...resource,
      mediaType: hasAlpha ? "image/png" : "image/jpeg",
      data: Uint8Array.from(output),
    },
    converted: shouldConvert,
    resized: shouldResize,
  };
}

async function buildCoverThumbnail(coverResource: LyceumTextualResource, profile: KindleFirmwareProfile): Promise<LyceumTextualResource | null> {
  const data = resourceBytes(coverResource);
  if (!data || data.length === 0) return null;

  const sharp = await getSharp();
  const output = await sharp(Buffer.from(data), { animated: false })
    .rotate()
    .resize({
      width: profile.thumbnailWidth,
      height: profile.thumbnailHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  return {
    id: `${coverResource.id || "cover"}-thumbnail`,
    href: thumbnailHrefFor(coverResource),
    mediaType: "image/jpeg",
    properties: "kindle-thumbnail",
    data: Uint8Array.from(output),
  };
}

export async function prepareKindleImages(pkg: LyceumPackage): Promise<KindleImagePreparation> {
  const profile = resolveKindleFirmwareProfile();
  if (!pkg.textual?.resources?.length) {
    return {
      pkg,
      convertedImageCount: 0,
      resizedImageCount: 0,
      thumbnailGenerated: false,
      firmwareProfile: profile.id,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  let convertedImageCount = 0;
  let resizedImageCount = 0;
  const resources: LyceumTextualResource[] = [];

  for (const resource of pkg.textual.resources) {
    if (!resource.mediaType.startsWith("image/")) {
      resources.push(resource);
      continue;
    }

    try {
      const prepared = await convertImageForKindle(resource, profile);
      resources.push(prepared.resource);
      if (prepared.converted) convertedImageCount += 1;
      if (prepared.resized) resizedImageCount += 1;
    } catch (error) {
      resources.push(resource);
      warnings.push(`Imagem ${resource.href} nao pode ser preparada para Kindle (${error instanceof Error ? error.message : "erro desconhecido"}); sera omitida se o formato nao for suportado.`);
    }
  }

  const coverResource = resources.find((resource) => hasManifestProperty(resource, "cover-image"));
  let thumbnailGenerated = false;
  if (coverResource && !resources.some((resource) => hasManifestProperty(resource, "kindle-thumbnail"))) {
    try {
      const thumbnail = await buildCoverThumbnail(coverResource, profile);
      if (thumbnail) {
        resources.push({
          ...thumbnail,
          properties: appendManifestProperty(thumbnail.properties, "kindle-thumbnail"),
        });
        thumbnailGenerated = true;
      }
    } catch (error) {
      warnings.push(`Thumbnail Kindle da capa ${coverResource.href} nao pode ser gerado (${error instanceof Error ? error.message : "erro desconhecido"}).`);
    }
  }

  return {
    pkg: {
      ...pkg,
      textual: {
        ...pkg.textual,
        resources,
      },
    },
    convertedImageCount,
    resizedImageCount,
    thumbnailGenerated,
    firmwareProfile: profile.id,
    warnings,
  };
}
