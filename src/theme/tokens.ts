import {
  getAccentColor,
  type AccentColorId,
  type AccentPalette,
} from "./palettes";

export const SEMANTIC_TOKENS = {
  background: "Application background.",
  foreground: "Primary text and icons.",
  surface: "Cards, panels and raised areas.",
  "surface-muted": "Secondary or recessed surfaces.",
  "foreground-muted": "Secondary text.",
  "foreground-subtle": "Tertiary text, hints and placeholders.",
  border: "Default divider and container border.",
  "border-strong": "Emphasized border for controls and hover states.",
  input: "Editable field background.",
  "input-border": "Editable field border.",
  "input-placeholder": "Placeholder text inside editable fields.",
  primary: "Primary action and selected state.",
  "primary-hover": "Hover state of a primary action.",
  "primary-foreground": "Content placed on top of a primary action.",
  "primary-muted": "Soft primary background for selected states and badges.",
  "primary-border": "Soft primary border paired with primary-muted.",
  selection: "Text or item selection background.",
  "selection-foreground": "Content inside a selection.",
  "focus-ring": "Visible keyboard focus indicator.",
  success: "Positive status text and icons.",
  "success-muted": "Soft success background.",
  "success-foreground": "Content placed on top of a solid success action.",
  warning: "Warning status text and icons.",
  "warning-muted": "Soft warning background.",
  "warning-foreground": "Content placed on top of a solid warning action.",
  destructive: "Destructive action and error text.",
  "destructive-hover": "Hover state of a destructive action.",
  "destructive-foreground": "Content placed on top of a destructive action.",
  "destructive-muted": "Soft destructive background.",
  info: "Informational status text and icons.",
  "info-muted": "Soft informational background.",
  "info-foreground": "Content placed on top of a solid informational action.",
  overlay: "Translucent chrome that floats over content.",
  backdrop: "Dimming layer behind modals and dialogs.",
  link: "Inline and standalone links.",
  shadow: "Default shadow color.",
} as const;

export type SemanticTokenName = keyof typeof SEMANTIC_TOKENS;

export const SEMANTIC_TOKEN_NAMES = Object.keys(
  SEMANTIC_TOKENS,
) as SemanticTokenName[];

export type SemanticTokenValues = Record<SemanticTokenName, string>;

type AccentTokenName =
  | "primary"
  | "primary-hover"
  | "primary-foreground"
  | "primary-muted"
  | "primary-border"
  | "selection"
  | "focus-ring"
  | "link";

type BaseTokenName = Exclude<SemanticTokenName, AccentTokenName>;
type BaseTokenValues = Record<BaseTokenName, string>;

export type EffectiveTheme = "light" | "dark";

const ZINC = {
  50: "#fafafa",
  100: "#f4f4f5",
  200: "#e4e4e7",
  300: "#d4d4d8",
  400: "#a1a1aa",
  500: "#71717a",
  600: "#52525b",
  700: "#3f3f46",
  800: "#27272a",
  900: "#18181b",
  950: "#09090b",
} as const;

const DARK_BASE: BaseTokenValues = {
  background: ZINC[950],
  foreground: ZINC[100],
  surface: ZINC[900],
  "surface-muted": ZINC[800],
  "foreground-muted": ZINC[400],
  "foreground-subtle": "#82828c",
  border: ZINC[800],
  "border-strong": ZINC[700],
  input: ZINC[900],
  "input-border": ZINC[700],
  "input-placeholder": "#8a8a93",
  "selection-foreground": ZINC[50],
  success: "#4ade80",
  "success-muted": "color-mix(in srgb, #4ade80 16%, transparent)",
  "success-foreground": "#052e16",
  warning: "#fbbf24",
  "warning-muted": "color-mix(in srgb, #fbbf24 16%, transparent)",
  "warning-foreground": "#451a03",
  destructive: "#f87171",
  "destructive-hover": "#fca5a5",
  "destructive-foreground": "#450a0a",
  "destructive-muted": "color-mix(in srgb, #f87171 16%, transparent)",
  info: "#60a5fa",
  "info-muted": "color-mix(in srgb, #60a5fa 16%, transparent)",
  "info-foreground": "#172554",
  overlay: "rgb(24 24 27 / 0.95)",
  backdrop: "rgb(0 0 0 / 0.5)",
  shadow: "rgb(0 0 0 / 0.4)",
};

const LIGHT_BASE: BaseTokenValues = {
  // Light theme with clear layering: a slightly tinted canvas, pure white
  // surfaces that lift off it, and muted fills/borders dark enough to read
  // as structure (the previous values were all within a few % of white).
  background: "#eef0f3",
  foreground: "#0f172a",
  surface: "#ffffff",
  "surface-muted": "#e6e9ee",
  "foreground-muted": "#3f4654",
  "foreground-subtle": "#566070",
  border: "#d5d9e0",
  "border-strong": "#aeb6c2",
  input: "#ffffff",
  "input-border": "#aeb6c2",
  "input-placeholder": "#6b7483",
  "selection-foreground": "#0b1220",
  success: "#166534",
  "success-muted": "color-mix(in srgb, #166534 12%, transparent)",
  "success-foreground": "#ffffff",
  warning: "#92400e",
  "warning-muted": "color-mix(in srgb, #92400e 12%, transparent)",
  "warning-foreground": "#ffffff",
  destructive: "#b91c1c",
  "destructive-hover": "#991b1b",
  "destructive-foreground": "#ffffff",
  "destructive-muted": "color-mix(in srgb, #b91c1c 10%, transparent)",
  info: "#1d4ed8",
  "info-muted": "color-mix(in srgb, #1d4ed8 10%, transparent)",
  "info-foreground": "#ffffff",
  overlay: "rgb(255 255 255 / 0.97)",
  backdrop: "rgb(15 23 42 / 0.45)",
  shadow: "rgb(15 23 42 / 0.16)",
};

function resolveAccentTokens(
  theme: EffectiveTheme,
  palette: AccentPalette,
): Record<AccentTokenName, string> {
  const isDark = theme === "dark";
  // Light mode uses the 800 step so accent text and buttons keep AA
  // contrast on the tinted canvas.
  const primary = isDark ? palette[400] : palette[800];
  const hover = isDark ? palette[300] : palette[900];

  return {
    primary,
    "primary-hover": hover,
    "primary-foreground": isDark ? palette[950] : "#ffffff",
    "primary-muted": `color-mix(in srgb, ${primary} ${isDark ? 18 : 12}%, transparent)`,
    "primary-border": `color-mix(in srgb, ${primary} ${isDark ? 42 : 38}%, transparent)`,
    selection: `color-mix(in srgb, ${primary} 30%, transparent)`,
    "focus-ring": primary,
    link: isDark ? palette[300] : palette[800],
  };
}

/**
 * Resolves the complete semantic token set for an appearance + accent
 * combination. Results are deterministic and contain no unvalidated input.
 */
export function resolveThemeTokens(
  theme: EffectiveTheme,
  accentColor: AccentColorId | string | null | undefined,
): SemanticTokenValues {
  const accent = getAccentColor(accentColor);
  return {
    ...(theme === "light" ? LIGHT_BASE : DARK_BASE),
    ...resolveAccentTokens(theme === "light" ? "light" : "dark", accent.palette),
  };
}

/** Default (green) token sets, useful for boot fallbacks and documentation. */
export const DARK_TOKENS: SemanticTokenValues = resolveThemeTokens(
  "dark",
  "green",
);
export const LIGHT_TOKENS: SemanticTokenValues = resolveThemeTokens(
  "light",
  "green",
);

export function toCssCustomProperties(
  tokens: SemanticTokenValues,
): Record<`--${string}`, string> {
  const properties: Record<`--${string}`, string> = {};
  for (const name of SEMANTIC_TOKEN_NAMES) {
    properties[`--${name}`] = tokens[name];
  }
  return properties;
}

function channelToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (!match) return null;
  let hex = match[1]!;
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .slice(0, 3)
      .split("")
      .map((part) => part + part)
      .join("");
  } else if (hex.length === 8) {
    hex = hex.slice(0, 6);
  } else if (hex.length !== 6) {
    return null;
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * WCAG 2.x contrast ratio for two opaque colors. Returns null for values that
 * cannot be evaluated statically (for example `color-mix(...)`).
 */
export function contrastRatio(
  foreground: string,
  background: string,
): number | null {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) return null;

  const luminance = (rgb: [number, number, number]) =>
    0.2126 * channelToLinear(rgb[0]) +
    0.7152 * channelToLinear(rgb[1]) +
    0.0722 * channelToLinear(rgb[2]);

  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}
