export type KindleFirmwareFamily = "legacy-paperwhite" | "kindle-compatible" | "modern-kindle" | "scribe";

export interface KindleFirmwareProfile {
  id: KindleFirmwareFamily;
  label: string;
  maxImageEdge: number;
  maxImageBytes: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  safeImageTypes: ReadonlySet<string>;
  notes: string[];
}

const SAFE_RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);

export const KINDLE_FIRMWARE_PROFILES: Record<KindleFirmwareFamily, KindleFirmwareProfile> = {
  "legacy-paperwhite": {
    id: "legacy-paperwhite",
    label: "Paperwhite legado",
    maxImageEdge: 1920,
    maxImageBytes: 3 * 1024 * 1024,
    thumbnailWidth: 330,
    thumbnailHeight: 470,
    safeImageTypes: SAFE_RASTER_TYPES,
    notes: ["Evita SVG/WebP, imagens muito grandes, CSS fixed e tabelas largas."],
  },
  "kindle-compatible": {
    id: "kindle-compatible",
    label: "Compatibilidade Kindle ampla",
    maxImageEdge: 2560,
    maxImageBytes: 5 * 1024 * 1024,
    thumbnailWidth: 330,
    thumbnailHeight: 470,
    safeImageTypes: SAFE_RASTER_TYPES,
    notes: ["Perfil padrao conservador para sideload em firmwares antigos e modernos."],
  },
  "modern-kindle": {
    id: "modern-kindle",
    label: "Kindle moderno",
    maxImageEdge: 3200,
    maxImageBytes: 8 * 1024 * 1024,
    thumbnailWidth: 330,
    thumbnailHeight: 470,
    safeImageTypes: SAFE_RASTER_TYPES,
    notes: ["Mantem maior resolucao sem depender de formatos raster recentes."],
  },
  scribe: {
    id: "scribe",
    label: "Kindle Scribe",
    maxImageEdge: 4096,
    maxImageBytes: 10 * 1024 * 1024,
    thumbnailWidth: 330,
    thumbnailHeight: 470,
    safeImageTypes: SAFE_RASTER_TYPES,
    notes: ["Permite paginas e diagramas maiores para a tela de alta resolucao."],
  },
};

export function resolveKindleFirmwareProfile(value = process.env.LYCEUM_KINDLE_PROFILE): KindleFirmwareProfile {
  return value && value in KINDLE_FIRMWARE_PROFILES
    ? KINDLE_FIRMWARE_PROFILES[value as KindleFirmwareFamily]
    : KINDLE_FIRMWARE_PROFILES["kindle-compatible"];
}
