export const ACCENT_COLOR_IDS = [
  "green",
  "blue",
  "violet",
  "amber",
  "rose",
  "cyan",
] as const;

export type AccentColorId = (typeof ACCENT_COLOR_IDS)[number];

export type AccentPaletteStep =
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 950;

export type AccentPalette = Record<AccentPaletteStep, string>;

export const ACCENT_PALETTE_STEPS: AccentPaletteStep[] = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
];

export interface AccentColor {
  id: AccentColorId;
  label: string;
  swatch: string;
  foreground: string;
  palette: AccentPalette;
}

export const DEFAULT_ACCENT_COLOR: AccentColorId = "green";

export const ACCENT_COLORS: AccentColor[] = [
  {
    id: "green",
    label: "Verde",
    swatch: "#16a34a",
    foreground: "#ffffff",
    palette: {
      50: "#f0fdf4",
      100: "#dcfce7",
      200: "#bbf7d0",
      300: "#86efac",
      400: "#4ade80",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
      800: "#166534",
      900: "#14532d",
      950: "#052e16",
    },
  },
  {
    id: "blue",
    label: "Azul",
    swatch: "#2563eb",
    foreground: "#ffffff",
    palette: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
      950: "#172554",
    },
  },
  {
    id: "violet",
    label: "Violeta",
    swatch: "#7c3aed",
    foreground: "#ffffff",
    palette: {
      50: "#f5f3ff",
      100: "#ede9fe",
      200: "#ddd6fe",
      300: "#c4b5fd",
      400: "#a78bfa",
      500: "#8b5cf6",
      600: "#7c3aed",
      700: "#6d28d9",
      800: "#5b21b6",
      900: "#4c1d95",
      950: "#2e1065",
    },
  },
  {
    id: "amber",
    label: "Âmbar",
    swatch: "#d97706",
    foreground: "#1c1917",
    palette: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
      950: "#451a03",
    },
  },
  {
    id: "rose",
    label: "Rosa",
    swatch: "#e11d48",
    foreground: "#ffffff",
    palette: {
      50: "#fff1f2",
      100: "#ffe4e6",
      200: "#fecdd3",
      300: "#fda4af",
      400: "#fb7185",
      500: "#f43f5e",
      600: "#e11d48",
      700: "#be123c",
      800: "#9f1239",
      900: "#881337",
      950: "#4c0519",
    },
  },
  {
    id: "cyan",
    label: "Ciano",
    swatch: "#0891b2",
    foreground: "#ffffff",
    palette: {
      50: "#ecfeff",
      100: "#cffafe",
      200: "#a5f3fc",
      300: "#67e8f9",
      400: "#22d3ee",
      500: "#06b6d4",
      600: "#0891b2",
      700: "#0e7490",
      800: "#155e75",
      900: "#164e63",
      950: "#083344",
    },
  },
];

export function isAccentColorId(value: unknown): value is AccentColorId {
  return (
    typeof value === "string" &&
    (ACCENT_COLOR_IDS as readonly string[]).includes(value)
  );
}

export function getAccentColor(accentColor: unknown): AccentColor {
  const id = isAccentColorId(accentColor) ? accentColor : DEFAULT_ACCENT_COLOR;
  return ACCENT_COLORS.find((color) => color.id === id) ?? ACCENT_COLORS[0]!;
}
