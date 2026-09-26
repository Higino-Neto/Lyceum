import type { TranslationResources } from "./resources";

/**
 * Every translation key known to the app, as `namespace:dotted.path`.
 * Derived from the reference language (`en`), so adding a key to
 * `src/i18n/en/<namespace>.json` immediately makes it available (and required)
 * for every other language.
 */
export type TranslationKey = {
  [Namespace in keyof TranslationResources & string]: `${Namespace}:${NamespaceKeys<
    TranslationResources[Namespace]
  >}`;
}[keyof TranslationResources & string];

type NamespaceKeys<Resource> = WithPluralBase<LeafKeys<Resource>>;

type LeafKeys<Resource> = Resource extends string
  ? never
  : {
      [Key in keyof Resource & string]: Resource[Key] extends string
        ? Key
        : `${Key}.${LeafKeys<Resource[Key]>}`;
    }[keyof Resource & string];

/**
 * i18next resolves `key` to `key_one` / `key_other` at runtime. Those suffixed
 * keys are valid call sites too, so both forms are accepted.
 */
type WithPluralBase<Key extends string> = Key extends unknown
  ? Key extends `${infer Base}_${PluralSuffix}`
    ? Base | Key
    : Key
  : never;

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";

export type TranslateOptions = Record<string, unknown>;

/** Translation lookup. Keys are checked at compile time, values are `string`. */
export type Translate = (key: TranslationKey, options?: TranslateOptions) => string;
