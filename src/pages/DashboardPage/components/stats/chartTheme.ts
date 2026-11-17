/** Shared recharts styling for the dashboard tabs (recessive axes and grid). */
export const axisProps = {
  stroke: "var(--foreground-subtle)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = {
  stroke: "var(--viz-grid)",
  vertical: false,
} as const;

/** Bars keep a small 2px radius on the data end only. */
export const BAR_RADIUS: [number, number, number, number] = [2, 2, 0, 0];
export const BAR_RADIUS_HORIZONTAL: [number, number, number, number] = [0, 2, 2, 0];

/** Categorical colour slot `n` (1–8), in fixed order. */
export const viz = (n: number) => `var(--viz-${((n - 1) % 8) + 1})`;

/** Sequential step 0–4 derived from the accent colour. */
export const seq = (level: number) => `var(--viz-seq-${Math.max(0, Math.min(4, level))})`;

export const ICON_SIZE = 16;
export const STROKE_WIDTH = 1.5;
