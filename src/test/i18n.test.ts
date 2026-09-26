import { describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from "../i18n/config";
import { detectLanguage } from "../i18n/detectLanguage";
import { i18next } from "../i18n";
import { NAMESPACE_KEYS, resources } from "../i18n/resources";
import { readStoredLanguage, writeStoredLanguage } from "../i18n/storage";

type JsonTree = { [key: string]: string | JsonTree };

function collectKeys(tree: JsonTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : collectKeys(value, path);
  });
}

describe("i18n resources", () => {
  const languages = SUPPORTED_LANGUAGES.map((language) => language.code);

  it.each(languages)("keeps %s in sync with the reference shape", (code) => {
    const tree = resources[code] as unknown as Record<string, JsonTree>;

    expect(Object.keys(tree).sort()).toEqual([...NAMESPACE_KEYS].sort());

    for (const namespace of NAMESPACE_KEYS) {
      const reference = collectKeys(resources[DEFAULT_LANGUAGE][namespace] as JsonTree);
      const translation = collectKeys(tree[namespace] as JsonTree);

      expect(
        translation.filter((key) => !reference.includes(key)),
        `${code}/${namespace} has keys missing from ${DEFAULT_LANGUAGE}`,
      ).toEqual([]);
      expect(
        reference.filter((key) => !translation.includes(key)),
        `${DEFAULT_LANGUAGE}/${namespace} has keys missing from ${code}`,
      ).toEqual([]);
    }
  });

  it.each(languages)("never leaves a %s value empty", (code) => {
    for (const namespace of NAMESPACE_KEYS) {
      for (const key of collectKeys(resources[code][namespace] as JsonTree)) {
        const value = key
          .split(".")
          .reduce<JsonTree | string>((node, part) => (node as JsonTree)[part], resources[code][namespace] as JsonTree);
        expect(typeof value === "string" && value.trim().length > 0, `${code}/${namespace}/${key}`).toBe(true);
      }
    }
  });
});

describe("detectLanguage", () => {
  it("prefers the stored choice over the browser", () => {
    expect(detectLanguage({ storedLanguage: "en", preferredLanguages: ["pt-BR"] })).toBe("en");
  });

  it("matches browser tags exactly and then by base language", () => {
    expect(detectLanguage({ preferredLanguages: ["en-GB"] })).toBe("en");
    expect(detectLanguage({ preferredLanguages: ["pt-PT"] })).toBe("pt-BR");
  });

  it("falls back to the default language", () => {
    expect(detectLanguage({ preferredLanguages: ["fr-FR"] })).toBe(DEFAULT_LANGUAGE);
    expect(detectLanguage({ storedLanguage: "not-a-language" })).toBe(DEFAULT_LANGUAGE);
    expect(detectLanguage()).toBe(DEFAULT_LANGUAGE);
  });
});

describe("language storage", () => {
  it("round-trips the selected language", () => {
    writeStoredLanguage("en");
    expect(readStoredLanguage()).toBe("en");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");

    window.localStorage.clear();
    expect(readStoredLanguage()).toBeNull();
  });
});

describe("i18next instance", () => {
  it("translates keys for every supported language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      i18next.changeLanguage(language.code);
      expect(i18next.t("common:actions.save")).not.toBe("common:actions.save");
      expect(i18next.t("settings:title")).not.toBe("settings:title");
    }
  });

  it("pluralizes with the requested language", () => {
    i18next.changeLanguage("en");
    expect(i18next.t("common:units.page", { count: 1 })).toBe("1 page");
    expect(i18next.t("common:units.page", { count: 3 })).toBe("3 pages");

    i18next.changeLanguage("pt-BR");
    expect(i18next.t("common:units.page", { count: 1 })).toBe("1 página");
    expect(i18next.t("common:units.page", { count: 3 })).toBe("3 páginas");
  });

  it("interpolates values in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      i18next.changeLanguage(language.code);
      expect(i18next.t("friends:list.title", { count: 2 })).toContain("2");
    }
  });
});
