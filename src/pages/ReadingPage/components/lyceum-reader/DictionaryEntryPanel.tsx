import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { RELATION_ORDER, type PackEntry } from "../../../../core/dictionary-packs";
import { useDictionaryPackEntry } from "./useDictionaryPackEntry";
import { useTranslation } from "../../../../i18n";
import { DictionaryOffer } from "./DictionaryOffer";
import { dynamicT } from "./uiHelpers";

let currentAudio: HTMLAudioElement | null = null;
function playAudio(url: string) {
  currentAudio?.pause();
  currentAudio = new Audio(url);
  void currentAudio.play().catch(() => undefined);
}

function useTag() {
  const { t } = useTranslation();
  return (tag: string) => dynamicT(t, `learning:dictionary.tags.${tag}`, undefined, tag.replace(/-/g, " "));
}

function TagList({ tags }: { tags: string[] }) {
  const tag = useTag();
  if (tags.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {tags.slice(0, 6).map((value) => (
        <span key={value} className="rounded-sm bg-surface-muted px-1 py-px text-[10px] uppercase tracking-wide text-foreground-subtle">{tag(value)}</span>
      ))}
    </span>
  );
}

function WordChips({ words, lang }: { words: string[]; lang?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {words.map((word) => (
        <span key={word} className="rounded-sm border border-border px-1.5 py-0.5 text-xs text-foreground" lang={lang}>{word}</span>
      ))}
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle hover:text-foreground cursor-pointer">
        {open ? "▾" : "▸"} {title}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

const SENSES_COLLAPSED = 4;

function EntryView({ entry, lang, target, compact }: { entry: PackEntry; lang: string; target: string; compact?: boolean }) {
  const { t } = useTranslation();
  const tag = useTag();
  const [allSenses, setAllSenses] = useState(false);
  const senses = entry.senses.filter((sense) => !sense.formOf?.length || entry.senses.length === 1);
  const visibleSenses = allSenses ? senses : senses.slice(0, compact ? 2 : SENSES_COLLAPSED);
  const relations = RELATION_ORDER.filter((name) => entry.relations[name]?.length);
  const pos = entry.pos ? dynamicT(t, `learning:dictionary.pos.${entry.pos}`, undefined, entry.pos) : null;

  return (
    <article className="py-2 first:pt-0">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-foreground">
            <span className="font-serif text-base font-semibold" lang={lang}>{entry.word}</span>
            {pos && <span className="ml-2 text-xs text-foreground-muted">{pos}</span>}
          </p>
          {entry.head && entry.head !== entry.word && <p className="text-xs text-foreground-subtle" lang={lang}>{entry.head}</p>}
          {entry.matchedForm && (
            <p className="mt-0.5 text-xs text-foreground-muted">
              <span lang={lang}>{entry.matchedForm.form}</span>
              {entry.matchedForm.tags.length > 0 && <> · {entry.matchedForm.tags.map(tag).join(", ")}</>}
              {" "}{t("learning:dictionary.formOf")} <span className="text-foreground" lang={lang}>{entry.word}</span>
            </p>
          )}
          {entry.ipa.length > 0 && <p className="mt-0.5 font-mono text-xs text-foreground-muted">{entry.ipa.slice(0, 2).join(" · ")}</p>}
        </div>
        {entry.audio[0] && (
          <button
            type="button"
            onClick={() => playAudio(entry.audio[0]!.url)}
            title={[t("learning:dictionary.play"), ...entry.audio[0]!.tags.map(tag)].join(" · ")}
            aria-label={t("learning:dictionary.play")}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-foreground-muted hover:bg-surface-muted hover:text-foreground cursor-pointer"
          >
            <Volume2 size={15} />
          </button>
        )}
      </header>

      {entry.translations.length > 0 && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {entry.translations.slice(0, compact ? 6 : 14).map((translation) => (
              <span key={translation.word} title={translation.sense ? `${t("learning:dictionary.sense")}: ${translation.sense}` : undefined} className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-foreground" lang={target}>
                {translation.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {visibleSenses.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-snug text-foreground marker:text-foreground-subtle">
          {visibleSenses.map((sense, index) => (
            <li key={`${sense.gloss}-${index}`}>
              <TagList tags={sense.tags} /> {sense.gloss}
              {!compact && sense.examples.slice(0, 2).map((example) => (
                <p key={example.text} className="mt-0.5 font-serif text-xs italic text-foreground-muted" lang={lang}>
                  {example.text}
                  {example.translation && <span className="not-italic text-foreground-subtle"> — {example.translation}</span>}
                </p>
              ))}
              {!compact && (["synonyms", "antonyms"] as const).map((name) => sense.relations[name]?.length ? (
                <p key={name} className="mt-0.5 text-xs text-foreground-muted">
                  <span className="text-foreground-subtle">{dynamicT(t, `learning:dictionary.relations.${name}`)}: </span>
                  <span lang={lang}>{sense.relations[name]!.slice(0, 8).join(", ")}</span>
                </p>
              ) : null)}
            </li>
          ))}
        </ol>
      )}
      {senses.length > visibleSenses.length || allSenses ? (
        <button type="button" onClick={() => setAllSenses((value) => !value)} className="mt-1 text-xs text-primary hover:underline cursor-pointer">
          {allSenses ? t("learning:dictionary.showLess") : `${t("learning:dictionary.showMore")} (${senses.length - visibleSenses.length})`}
        </button>
      ) : null}

      {!compact && relations.map((name) => (
        <div key={name} className="mt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">{dynamicT(t, `learning:dictionary.relations.${name}`)}</p>
          <WordChips words={entry.relations[name]!.slice(0, 20)} lang={lang} />
        </div>
      ))}

      {!compact && entry.forms.length > 0 && (
        <Collapsible title={t("learning:dictionary.forms")}>
          <table className="w-full text-xs">
            <tbody>
              {entry.forms.slice(0, 40).map((form, index) => (
                <tr key={`${form.form}-${index}`} className="border-b border-border/50 last:border-0">
                  <td className="py-0.5 pr-2 text-foreground" lang={lang}>{form.form}</td>
                  <td className="py-0.5 text-foreground-subtle">{form.tags.map(tag).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Collapsible>
      )}

      {!compact && entry.etymology && (
        <Collapsible title={t("learning:dictionary.etymology")}>
          <p className="whitespace-pre-line text-xs leading-relaxed text-foreground-muted">{entry.etymology}</p>
        </Collapsible>
      )}
      {!compact && entry.hyphenation && entry.hyphenation.length > 1 && (
        <p className="mt-2 text-xs text-foreground-subtle">{t("learning:dictionary.hyphenation")}: <span lang={lang}>{entry.hyphenation.join("·")}</span></p>
      )}
    </article>
  );
}

/**
 * Full Wiktionary entry for the selected word: translations, meanings with
 * examples, pronunciation, relations, inflections and etymology.
 */
export function DictionaryEntryPanel({ form, lemma, lang, target, revision, compact }: { form: string | null; lemma: string | null; lang: string; target: string; revision?: number; compact?: boolean }) {
  const { t } = useTranslation();
  const state = useDictionaryPackEntry(form, lemma, lang, target, revision);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [form, lemma]);

  if (state.status === "loading") return <p className="flex items-center gap-1.5 text-xs text-foreground-subtle"><Loader2 size={12} className="animate-spin" />…</p>;
  if (state.status === "no-pack") {
    return (
      <div>
        <p className="text-xs text-foreground-subtle">{t("learning:dictionary.noPack")}</p>
        <DictionaryOffer />
      </div>
    );
  }
  const result = state.result;
  if (!result?.found) return <p className="text-xs text-foreground-subtle">{t("learning:dictionary.notFound")}</p>;
  const hasTargetTranslation = result.entries.some((entry) => entry.translations.length > 0);
  const base = (code: string) => code.toLowerCase().split(/[-_]/)[0];

  return (
    <div ref={scrollRef} className="divide-y divide-border/60">
      {!hasTargetTranslation && base(target) !== base(lang) && base(target) !== "en" && (
        <p className="pb-2 text-[11px] text-foreground-subtle">{t("learning:dictionary.englishOnly")}</p>
      )}
      {result.entries.map((entry, index) => (
        <EntryView key={`${entry.word}-${entry.pos}-${index}`} entry={entry} lang={lang} target={target} compact={compact} />
      ))}
      <p className="pt-2 text-[10px] text-foreground-subtle">{t("learning:dictionary.attribution")}</p>
    </div>
  );
}
