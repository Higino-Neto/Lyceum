// Pure data module: safe to import from the renderer and from Node workers.

export type KindleImagePresetId =
  | "kindle-basic"
  | "kindle-paperwhite-legacy"
  | "kindle-paperwhite"
  | "kindle-oasis"
  | "kindle-scribe"
  | "kindle-colorsoft";

export type ImagePresetId = "original" | "custom" | KindleImagePresetId;

export type KindleProfileId = "legacy-paperwhite" | "kindle-compatible" | "modern-kindle" | "scribe";

export interface KindleImagePreset {
  id: KindleImagePresetId;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  grayscale: boolean;
  kindleProfile: KindleProfileId;
}

export const KINDLE_IMAGE_PRESETS: Record<KindleImagePresetId, KindleImagePreset> = {
  "kindle-basic": { id: "kindle-basic", maxWidth: 1072, maxHeight: 1448, quality: 80, grayscale: true, kindleProfile: "kindle-compatible" },
  "kindle-paperwhite-legacy": { id: "kindle-paperwhite-legacy", maxWidth: 1072, maxHeight: 1448, quality: 80, grayscale: true, kindleProfile: "legacy-paperwhite" },
  "kindle-paperwhite": { id: "kindle-paperwhite", maxWidth: 1264, maxHeight: 1680, quality: 80, grayscale: true, kindleProfile: "modern-kindle" },
  "kindle-oasis": { id: "kindle-oasis", maxWidth: 1264, maxHeight: 1680, quality: 80, grayscale: true, kindleProfile: "modern-kindle" },
  "kindle-scribe": { id: "kindle-scribe", maxWidth: 1860, maxHeight: 2480, quality: 82, grayscale: true, kindleProfile: "scribe" },
  "kindle-colorsoft": { id: "kindle-colorsoft", maxWidth: 1264, maxHeight: 1680, quality: 82, grayscale: false, kindleProfile: "modern-kindle" },
};

export const IMAGE_PRESET_IDS: ImagePresetId[] = [
  "original",
  "kindle-basic",
  "kindle-paperwhite-legacy",
  "kindle-paperwhite",
  "kindle-oasis",
  "kindle-scribe",
  "kindle-colorsoft",
  "custom",
];

export const DEFAULT_CUSTOM_IMAGE_SETTINGS = {
  maxWidth: 1264,
  maxHeight: 1680,
  quality: 80,
};

export const IMAGE_DIMENSION_LIMITS = { min: 320, max: 8192 };
export const IMAGE_QUALITY_LIMITS = { min: 10, max: 100 };

export function isKindleImagePreset(value: unknown): value is KindleImagePresetId {
  return typeof value === "string" && value in KINDLE_IMAGE_PRESETS;
}

/** Source formats whose content can carry raster images that the optimizer touches. */
export const IMAGE_BEARING_SOURCE_FORMATS = new Set(["cbz", "pdf", "epub"]);
