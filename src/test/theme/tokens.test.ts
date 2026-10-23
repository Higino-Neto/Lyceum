import { describe, expect, it } from "vitest";
import {
  ACCENT_COLORS,
  ACCENT_PALETTE_STEPS,
  DEFAULT_ACCENT_COLOR,
  getAccentColor,
  isAccentColorId,
} from "../../theme/palettes";
import {
  DARK_TOKENS,
  LIGHT_TOKENS,
  SEMANTIC_TOKEN_NAMES,
  contrastRatio,
  resolveThemeTokens,
  toCssCustomProperties,
} from "../../theme/tokens";

const HEX_OR_FUNCTION_COLOR =
  /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl|oklch|color-mix)\(.+\))$/i;

describe("accent palettes", () => {
  it("exposes a complete primitive scale for every selectable accent", () => {
    expect(ACCENT_COLORS.length).toBeGreaterThanOrEqual(6);
    for (const accent of ACCENT_COLORS) {
      expect(isAccentColorId(accent.id)).toBe(true);
      for (const step of ACCENT_PALETTE_STEPS) {
        expect(accent.palette[step]).toMatch(HEX_OR_FUNCTION_COLOR);
      }
    }
  });

  it("falls back to the default accent for unknown values", () => {
    expect(getAccentColor("not-a-color").id).toBe(DEFAULT_ACCENT_COLOR);
    expect(getAccentColor(null).id).toBe(DEFAULT_ACCENT_COLOR);
    expect(getAccentColor(undefined).id).toBe(DEFAULT_ACCENT_COLOR);
    expect(isAccentColorId("not-a-color")).toBe(false);
  });
});

describe("semantic theme tokens", () => {
  it("defines unique, non-empty token names and values for both appearances", () => {
    expect(new Set(SEMANTIC_TOKEN_NAMES).size).toBe(SEMANTIC_TOKEN_NAMES.length);
    expect(SEMANTIC_TOKEN_NAMES).toEqual(
      expect.arrayContaining([
        "background",
        "foreground",
        "surface",
        "surface-muted",
        "border",
        "primary",
        "primary-foreground",
        "focus-ring",
        "destructive",
        "overlay",
      ]),
    );

    for (const theme of ["light", "dark"] as const) {
      for (const accent of ACCENT_COLORS) {
        const tokens = resolveThemeTokens(theme, accent.id);
        for (const name of SEMANTIC_TOKEN_NAMES) {
          expect(tokens[name], `${theme}/${accent.id}/${name}`).toBeTruthy();
          expect(tokens[name]).toMatch(HEX_OR_FUNCTION_COLOR);
        }
      }
    }
  });

  it("resolves explicit light and dark base values", () => {
    expect(DARK_TOKENS.background).toBe("#09090b");
    expect(DARK_TOKENS.foreground).toBe("#f4f4f5");
    expect(LIGHT_TOKENS.background).toBe("#f4f5f7");
    expect(LIGHT_TOKENS.foreground).toBe("#111827");

    expect(resolveThemeTokens("dark", "green").background).toBe("#09090b");
    expect(resolveThemeTokens("light", "green").background).toBe("#f4f5f7");
  });

  it("derives primary roles from the selected accent without changing base roles", () => {
    const green = resolveThemeTokens("dark", "green");
    const blue = resolveThemeTokens("dark", "blue");

    expect(green.primary).toBe("#4ade80");
    expect(blue.primary).toBe("#60a5fa");
    expect(green.primary).not.toBe(blue.primary);

    for (const name of SEMANTIC_TOKEN_NAMES) {
      if (
        name === "primary" ||
        name === "primary-hover" ||
        name === "primary-foreground" ||
        name === "primary-muted" ||
        name === "primary-border" ||
        name === "selection" ||
        name === "focus-ring" ||
        name === "link"
      ) {
        continue;
      }
      expect(blue[name], name).toBe(green[name]);
    }
  });

  it("chooses accessible accent foregrounds for both appearances", () => {
    // Dark surfaces use the bright 400 step with a dark foreground; light
    // surfaces use the deeper 700 step with white. Every accent must pass
    // WCAG AA for normal text so the settings palette is safe to offer.
    for (const accent of ACCENT_COLORS) {
      const dark = resolveThemeTokens("dark", accent.id);
      const light = resolveThemeTokens("light", accent.id);

      expect(
        contrastRatio(dark.primary, dark["primary-foreground"]),
        `dark ${accent.id}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(light.primary, light["primary-foreground"]),
        `light ${accent.id}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps body and status text above WCAG AA contrast", () => {
    for (const [theme, tokens] of [
      ["dark", DARK_TOKENS],
      ["light", LIGHT_TOKENS],
    ] as const) {
      for (const [foreground, background] of [
        [tokens.foreground, tokens.background],
        [tokens["foreground-muted"], tokens.background],
        [tokens.destructive, tokens.background],
        [tokens.success, tokens.background],
        [tokens.warning, tokens.background],
        [tokens.info, tokens.background],
      ] as const) {
        expect(
          contrastRatio(foreground, background),
          `${theme}: ${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }

      for (const [foreground, background] of [
        [tokens["destructive-foreground"], tokens.destructive],
        [tokens["success-foreground"], tokens.success],
        [tokens["warning-foreground"], tokens.warning],
        [tokens["info-foreground"], tokens.info],
      ] as const) {
        expect(
          contrastRatio(foreground, background),
          `${theme}: status foreground on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("maps every semantic token to a CSS custom property", () => {
    const tokens = resolveThemeTokens("light", "violet");
    const properties = toCssCustomProperties(tokens);

    expect(Object.keys(properties)).toHaveLength(SEMANTIC_TOKEN_NAMES.length);
    for (const name of SEMANTIC_TOKEN_NAMES) {
      expect(properties[`--${name}` as keyof typeof properties]).toBe(
        tokens[name],
      );
    }
  });

  it("returns null contrast for values that cannot be evaluated statically", () => {
    expect(contrastRatio("color-mix(in srgb, red 20%, transparent)", "#000")).toBeNull();
    expect(contrastRatio("not-a-color", "#000")).toBeNull();
  });
});
