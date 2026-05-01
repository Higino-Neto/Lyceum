import type { ThemeConfig } from "@embedpdf/react-pdf-viewer";
export const DARK_THEME = {
  accent: {
    primary: "var(--accent-500)",
    primaryHover: "var(--accent-600)",
    primaryActive: "var(--accent-700)",
    primaryLight: "var(--accent-900)",
    primaryForeground: "#ffffff",
  },
  background: {
    app: "var(--ui-zinc-900)",
    surface: "var(--ui-zinc-900)",
    surfaceAlt: "var(--ui-zinc-900)",
    elevated: "var(--ui-zinc-800)",
    overlay: "rgba(0,0,0,0.7)",
    input: "var(--ui-zinc-900)",
  },
  foreground: {
    primary: "var(--ui-zinc-100)",
    secondary: "var(--ui-zinc-300)",
    muted: "var(--ui-zinc-400)",
    disabled: "var(--ui-zinc-500)",
    onAccent: "#ffffff",
  },
  interactive: {
    hover: "var(--ui-zinc-800)",
    active: "var(--ui-zinc-700)",
    selected: "var(--accent-900)",
    focus: "var(--accent-500)",
  },
  border: {
    default: "var(--ui-zinc-800)",
    subtle: "var(--ui-zinc-900)",
    strong: "var(--accent-500)",
  },
  state: {
    error: "#ef4444",
    errorLight: "#7f1d1d",
    warning: "#f59e0b",
    warningLight: "#78350f",
    success: "var(--accent-500)",
    successLight: "var(--accent-900)",
    info: "#3b82f6",
    infoLight: "#1e3a8a",
  },
} satisfies ThemeConfig["dark"];
