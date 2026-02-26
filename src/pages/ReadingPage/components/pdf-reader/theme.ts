import type { ThemeConfig } from "@embedpdf/react-pdf-viewer";
export const DARK_THEME = {
  accent: {
    primary: "#22c55e",
    primaryHover: "#16a34a",
    primaryActive: "#15803d",
    primaryLight: "#14532d",
    primaryForeground: "#ffffff",
  },
  background: {
    app: "#18181b",
    surface: "#18181b",
    surfaceAlt: "#1f1f23",
    elevated: "#27272a",
    overlay: "rgba(0,0,0,0.7)",
    input: "#18181b",
  },
  foreground: {
    primary: "#f4f4f5",
    secondary: "#d4d4d8",
    muted: "#a1a1aa",
    disabled: "#71717a",
    onAccent: "#ffffff",
  },
  interactive: {
    hover: "#27272a",
    active: "#3f3f46",
    selected: "#14532d",
    focus: "#22c55e",
  },
  border: {
    default: "#27272a",
    subtle: "#1f1f23",
    strong: "#22c55e",
  },
  state: {
    error: "#ef4444",
    errorLight: "#7f1d1d",
    warning: "#f59e0b",
    warningLight: "#78350f",
    success: "#22c55e",
    successLight: "#14532d",
    info: "#3b82f6",
    infoLight: "#1e3a8a",
  },
} satisfies ThemeConfig["dark"];
