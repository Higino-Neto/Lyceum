import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { MobileBook } from "./types";

const THUMBNAIL_DIR = "lyceum-thumbnails";

type CoverSpec = {
  background: string;
  accent: string;
  foreground: string;
  title: string[];
  author?: string;
  motif: "street" | "enso" | "dots" | "fingerprint" | "wealth" | "mind" | "castle" | "mountains" | "moon" | "cloak" | "columns" | "paper" | "cartoon" | "bulb" | "plain";
};

const coverSpecs: Record<string, CoverSpec> = {
  "crime-castigo": {
    background: "#17231f",
    accent: "#d7c08c",
    foreground: "#eee1bd",
    title: ["CRIME", "E", "CASTIGO"],
    author: "FYODOR DOSTOEVSKY",
    motif: "street",
  },
  essencialismo: {
    background: "#151719",
    accent: "#c68a31",
    foreground: "#f5f1e7",
    title: ["ESSENCIALISMO"],
    author: "GREG McKEOWN",
    motif: "enso",
  },
  "habitos-atomicos": {
    background: "#f3eddd",
    accent: "#a97a2f",
    foreground: "#8a6325",
    title: ["Habitos", "Atomicos"],
    author: "James Clear",
    motif: "dots",
  },
  sapiens: {
    background: "#eee8dc",
    accent: "#b71c1c",
    foreground: "#9f1515",
    title: ["Sapiens"],
    author: "Yuval Noah Harari",
    motif: "fingerprint",
  },
  "pai-rico": {
    background: "#151518",
    accent: "#d7d7dc",
    foreground: "#f3f0e8",
    title: ["PAI", "RICO"],
    author: "Robert Kiyosaki",
    motif: "wealth",
  },
  mindset: {
    background: "#1b2d4f",
    accent: "#ffffff",
    foreground: "#f5f8ff",
    title: ["Mindset"],
    author: "Carol S. Dweck",
    motif: "mind",
  },
  "cry-of-honor": {
    background: "#0b6ea7",
    accent: "#bfe9ff",
    foreground: "#f8fbff",
    title: ["A CRY", "OF", "HONOR"],
    author: "MORGAN RICE",
    motif: "castle",
  },
  "dream-of-mortals": {
    background: "#4a2f19",
    accent: "#ffb545",
    foreground: "#fff2dc",
    title: ["A DREAM", "OF", "MORTALS"],
    author: "MORGAN RICE",
    motif: "mountains",
  },
  "fate-of-dragons": {
    background: "#b9a84b",
    accent: "#3b2e17",
    foreground: "#fff7bd",
    title: ["FATE", "OF", "DRAGONS"],
    author: "MORGAN RICE",
    motif: "moon",
  },
  "a-nuvem": {
    background: "#e5d99a",
    accent: "#00857f",
    foreground: "#13272b",
    title: ["A NUVEM"],
    author: "NEAL SHUSTERMAN",
    motif: "cloak",
  },
  "rule-of-queens": {
    background: "#27301d",
    accent: "#99a266",
    foreground: "#f4edc9",
    title: ["RULE", "OF", "QUEENS"],
    author: "MORGAN RICE",
    motif: "columns",
  },
  "ultima-suposicao": {
    background: "#f5f1e8",
    accent: "#111827",
    foreground: "#111827",
    title: ["A ULTIMA", "SUPOSICAO"],
    author: "ELI GOLDRATT",
    motif: "paper",
  },
  "ultima-supersticao": {
    background: "#cfd3d8",
    accent: "#f7cf2f",
    foreground: "#243547",
    title: ["A ULTIMA", "SUPERSTICAO"],
    author: "DANIEL ROPS",
    motif: "cartoon",
  },
  "common-sense-guide": {
    background: "#ffffff",
    accent: "#78b8dc",
    foreground: "#1b2937",
    title: ["A Common-Sense", "Guide"],
    author: "Jay Wengrow",
    motif: "bulb",
  },
  "aristotles-revenge": {
    background: "#151515",
    accent: "#8e8e8e",
    foreground: "#f5f1e5",
    title: ["Aristotle's", "Revenge"],
    author: "Philosophy",
    motif: "plain",
  },
  karamazov: {
    background: "#1b2430",
    accent: "#d0b26a",
    foreground: "#f3efe4",
    title: ["Os Irmaos", "Karamazov"],
    author: "Dostoevsky",
    motif: "plain",
  },
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitTitle(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return [value];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function motifMarkup(spec: CoverSpec) {
  switch (spec.motif) {
    case "street":
      return `
        <rect width="300" height="450" fill="#0d1413"/>
        <path d="M0 0 L300 0 L300 450 L0 450 Z" fill="${spec.background}"/>
        <circle cx="70" cy="76" r="18" fill="${spec.accent}" opacity=".88"/>
        <path d="M0 342 C44 315 72 330 109 300 C150 267 193 292 300 242 L300 450 L0 450 Z" fill="#0b1110" opacity=".72"/>
        <g stroke="${spec.accent}" stroke-width="3" opacity=".38">
          <path d="M65 90 L65 360"/>
          <path d="M38 114 L92 114"/>
          <path d="M47 142 L83 142"/>
        </g>
        <path d="M145 250 C158 218 188 222 199 252 L190 383 L151 383 Z" fill="#050607" opacity=".95"/>
        <path d="M168 219 C181 205 197 216 199 235 C190 245 176 247 164 240 Z" fill="#111827"/>
        <g opacity=".16" fill="#d8eadf">
          <rect x="18" y="126" width="31" height="78" rx="3"/>
          <rect x="248" y="104" width="27" height="96" rx="3"/>
          <rect x="29" y="229" width="39" height="98" rx="3"/>
        </g>`;
    case "enso":
      return `
        <rect width="300" height="450" fill="#151515"/>
        <path d="M33 306 C88 251 175 229 251 161" stroke="${spec.accent}" stroke-width="3" opacity=".95"/>
        <g fill="none" stroke="${spec.accent}" stroke-linecap="round" opacity=".88">
          <path d="M80 278 C99 214 191 207 213 265 C230 309 170 341 121 318 C93 305 76 292 80 278 Z" stroke-width="7"/>
          <path d="M91 274 C120 235 184 229 204 266 C219 294 186 326 139 318" stroke-width="3"/>
          <path d="M101 288 C130 252 182 252 195 278" stroke-width="2"/>
        </g>`;
    case "dots":
      return `
        <rect width="300" height="450" fill="${spec.background}"/>
        <g fill="${spec.accent}" opacity=".58">
          ${Array.from({ length: 120 }, (_, index) => {
            const x = 20 + ((index * 37) % 260);
            const y = 20 + ((index * 53) % 170);
            const r = 1 + (index % 3) * 0.45;
            return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
          }).join("")}
        </g>
        <text x="150" y="320" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#5a4634">Pequenas mudancas,</text>
        <text x="150" y="338" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#5a4634">resultados extraordinarios</text>`;
    case "fingerprint":
      return `
        <rect width="300" height="450" fill="${spec.background}"/>
        <g fill="none" stroke="#4f4a43" stroke-width="2" opacity=".62">
          ${Array.from({ length: 9 }, (_, index) => `<ellipse cx="150" cy="242" rx="${20 + index * 6}" ry="${29 + index * 8}"/>`).join("")}
          <path d="M150 184 C121 195 115 225 122 250"/>
          <path d="M151 207 C166 224 163 252 148 267"/>
        </g>`;
    case "wealth":
      return `
        <rect width="300" height="450" fill="#101012"/>
        <text x="150" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="65" font-weight="700" fill="${spec.accent}" letter-spacing="12">PAI</text>
        <text x="150" y="218" text-anchor="middle" font-family="Georgia, serif" font-size="35" font-weight="700" fill="${spec.accent}" letter-spacing="5">RICO</text>
        <path d="M66 325 C96 288 121 300 150 267 C182 232 217 271 239 236 L260 450 L40 450 Z" fill="#2a2a32" opacity=".78"/>`;
    case "mind":
      return `
        <rect width="300" height="450" fill="#12244a"/>
        <path d="M0 360 C58 314 95 329 139 292 C190 248 238 265 300 219 L300 450 L0 450 Z" fill="#07152e" opacity=".74"/>
        <g fill="#ffffff" opacity=".95">
          <circle cx="90" cy="126" r="18"/>
          <circle cx="127" cy="96" r="22"/>
          <circle cx="170" cy="101" r="24"/>
          <circle cx="204" cy="134" r="18"/>
          <circle cx="150" cy="140" r="42"/>
        </g>
        <path d="M111 155 C126 180 174 181 191 154" stroke="#12244a" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    case "castle":
      return `
        <path d="M48 355 C70 285 104 250 112 180 L136 180 L144 152 L162 180 L182 180 C190 254 226 288 246 355 Z" fill="#16334f" opacity=".92"/>
        <path d="M98 348 L98 168 L126 168 L126 128 L152 128 L152 168 L180 168 L180 348 Z" fill="${spec.accent}" opacity=".55"/>
        <path d="M42 372 C96 332 194 332 258 374 L258 420 L42 420 Z" fill="#071827" opacity=".72"/>`;
    case "mountains":
      return `
        <circle cx="57" cy="79" r="25" fill="${spec.accent}"/>
        <path d="M0 310 L78 191 L122 268 L167 171 L300 330 L300 450 L0 450 Z" fill="#211d19" opacity=".88"/>
        <path d="M0 362 C69 325 120 342 178 320 C222 303 260 315 300 298 L300 450 L0 450 Z" fill="#110d0b" opacity=".72"/>`;
    case "moon":
      return `
        <circle cx="70" cy="91" r="42" fill="${spec.foreground}" opacity=".45"/>
        <path d="M0 338 C69 276 102 324 151 259 C210 182 222 300 300 247 L300 450 L0 450 Z" fill="#453e1c" opacity=".6"/>
        <path d="M176 334 L176 246 L203 246 L203 210 L230 247 L248 247 L248 334 Z" fill="#211b13" opacity=".9"/>`;
    case "cloak":
      return `
        <path d="M0 0 L300 0 L300 450 Z" fill="${spec.accent}" opacity=".7"/>
        <path d="M73 58 C132 22 207 53 233 125 C203 185 217 301 258 405 L72 405 C96 293 94 203 65 129 C66 101 68 77 73 58 Z" fill="#102025"/>
        <path d="M118 122 C144 80 184 79 206 124 C169 152 147 152 118 122 Z" fill="#031014"/>`;
    case "columns":
      return `
        <rect x="0" y="0" width="300" height="450" fill="#10150e" opacity=".35"/>
        <rect x="46" y="96" width="34" height="285" rx="4" fill="${spec.foreground}" opacity=".36"/>
        <rect x="216" y="96" width="34" height="285" rx="4" fill="${spec.foreground}" opacity=".32"/>
        <path d="M0 330 C72 288 120 318 173 291 C219 268 251 288 300 260 L300 450 L0 450 Z" fill="#0f140c" opacity=".85"/>`;
    case "paper":
      return `
        <rect x="35" y="40" width="230" height="360" rx="3" fill="#fffdf8"/>
        <g fill="${spec.accent}" opacity=".72">${Array.from({ length: 16 }, (_, index) => `<rect x="58" y="${78 + index * 16}" width="${index % 3 === 0 ? 144 : 184}" height="4" rx="2"/>`).join("")}</g>`;
    case "cartoon":
      return `
        <rect x="0" y="0" width="300" height="450" fill="#aeb6c1"/>
        <path d="M25 306 C90 266 155 272 275 242 L275 450 L25 450 Z" fill="#2e445a"/>
        <circle cx="102" cy="245" r="37" fill="#f0d1bd"/>
        <path d="M63 219 C78 173 128 174 145 216 C119 205 91 206 63 219 Z" fill="#1e2937"/>
        <rect x="144" y="150" width="109" height="122" rx="12" fill="${spec.accent}" opacity=".9"/>`;
    case "bulb":
      return `
        <circle cx="160" cy="242" r="62" fill="${spec.accent}" opacity=".35"/>
        <path d="M124 244 C124 199 196 199 196 244 C196 267 178 277 174 302 L146 302 C142 276 124 267 124 244 Z" fill="#e9f7ff" stroke="${spec.accent}" stroke-width="8"/>
        <rect x="145" y="309" width="31" height="22" rx="6" fill="#64748b"/>
        <g fill="${spec.accent}" opacity=".55"><circle cx="88" cy="197" r="8"/><circle cx="228" cy="187" r="7"/><circle cx="226" cy="265" r="5"/><circle cx="92" cy="284" r="6"/></g>`;
    default:
      return `
        <path d="M0 316 C65 278 119 306 166 265 C211 226 248 253 300 206 L300 450 L0 450 Z" fill="${spec.accent}" opacity=".34"/>
        <rect x="40" y="70" width="220" height="310" rx="10" fill="#000" opacity=".13"/>`;
  }
}

function renderCoverSvg(spec: CoverSpec) {
  const titleLines = spec.title.map((line, index) => {
    const y = 252 + index * 38;
    const size = line.length > 13 ? 22 : 29;
    return `<text x="150" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="${size}" font-weight="700" fill="${spec.foreground}" letter-spacing="1">${escapeXml(line)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
    <defs>
      <linearGradient id="shade" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>
        <stop offset=".45" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity=".42"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".35"/>
      </filter>
    </defs>
    <rect width="300" height="450" fill="${spec.background}"/>
    ${motifMarkup(spec)}
    <rect width="300" height="450" fill="url(#shade)"/>
    <g filter="url(#shadow)">
      ${titleLines.join("")}
      ${spec.author ? `<text x="150" y="65" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="${spec.foreground}" opacity=".82" letter-spacing="1.4">${escapeXml(spec.author)}</text>` : ""}
    </g>
  </svg>`;
}

function renderGeneratedCoverSvg(book: MobileBook) {
  const palette = book.fileType === "pdf"
    ? { background: "#202026", accent: "#8aa4c8", foreground: "#f5f7fb" }
    : { background: "#14231d", accent: "#27c96f", foreground: "#f4fff8" };

  return renderCoverSvg({
    ...palette,
    title: splitTitle(book.title || book.fileName).slice(0, 3),
    author: book.author || book.fileType.toUpperCase(),
    motif: "plain",
  });
}

function getCoverSvg(book: MobileBook) {
  const spec = book.thumbnailKey ? coverSpecs[book.thumbnailKey] : undefined;
  return spec ? renderCoverSvg(spec) : renderGeneratedCoverSvg(book);
}

function getThumbnailPath(book: MobileBook) {
  const key = book.thumbnailKey || book.id;
  return `${THUMBNAIL_DIR}/${key.replace(/[^a-zA-Z0-9_-]+/g, "-")}.svg`;
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "thumbnail";
}

function splitDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
  return {
    mimeType: match?.[1] || "image/jpeg",
    data: match?.[2] || "",
  };
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("svg")) return "svg";
  return "jpg";
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function writeNativeThumbnail(path: string, svg: string) {
  await Filesystem.mkdir({
    path: THUMBNAIL_DIR,
    directory: Directory.Data,
    recursive: true,
  }).catch(() => undefined);

  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data: svg,
    encoding: Encoding.UTF8,
  });

  const uri = await Filesystem.getUri({
    path,
    directory: Directory.Data,
  });

  return Capacitor.convertFileSrc(uri.uri);
}

export async function persistExtractedBookThumbnail(book: MobileBook, dataUrl: string): Promise<Partial<MobileBook>> {
  const { mimeType, data } = splitDataUrl(dataUrl);

  if (!Capacitor.isNativePlatform()) {
    return {
      thumbnailPath: undefined,
      thumbnailUrl: dataUrl,
      thumbnailSource: "extracted",
      thumbnailExtractAttempted: true,
    };
  }

  const path = `${THUMBNAIL_DIR}/${safePathPart(book.id)}-cover.${extensionForMime(mimeType)}`;
  await Filesystem.mkdir({
    path: THUMBNAIL_DIR,
    directory: Directory.Data,
    recursive: true,
  }).catch(() => undefined);

  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data,
  });

  const uri = await Filesystem.getUri({
    path,
    directory: Directory.Data,
  });

  return {
    thumbnailPath: path,
    thumbnailUrl: Capacitor.convertFileSrc(uri.uri),
    thumbnailSource: "extracted",
    thumbnailExtractAttempted: true,
  };
}

export async function deleteMobileBookThumbnail(book?: MobileBook | null) {
  if (!book?.thumbnailPath || !Capacitor.isNativePlatform()) return;
  await Filesystem.deleteFile({
    path: book.thumbnailPath,
    directory: Directory.Data,
  }).catch(() => undefined);
}

export async function hydrateMobileBookThumbnails(books: MobileBook[]): Promise<{ books: MobileBook[]; changed: boolean }> {
  const native = Capacitor.isNativePlatform();
  let changed = false;

  const hydrated = await Promise.all(books.map(async (book) => {
    if (book.thumbnailSource === "extracted" && book.thumbnailUrl) {
      return book;
    }

    if (book.thumbnailUrl && !book.thumbnailUrl.startsWith("data:image/svg+xml")) {
      return book;
    }

    const path = getThumbnailPath(book);
    const svg = getCoverSvg(book);
    const thumbnailUrl = native ? await writeNativeThumbnail(path, svg) : svgDataUrl(svg);

    if (book.thumbnailPath === path && book.thumbnailUrl === thumbnailUrl) {
      return book;
    }

    changed = true;
    return {
      ...book,
      thumbnailPath: path,
      thumbnailUrl,
      thumbnailSource: "generated" as const,
    };
  }));

  return { books: hydrated, changed };
}
