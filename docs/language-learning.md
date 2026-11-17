# Language-Learning Reader

A third reader in `/reading` (next to the PDF and EPUB readers) for reading a
book in a foreign language while tracking vocabulary. Tabs use
`FileType = "lyceum"`. In the library, the book detail panel has an
"Open for language learning (.lyceum)" button; `.lyceum` packages in the
library open in this reader directly.

## Data flow

```text
Library ─▶ /reading tab (fileType "lyceum", source path + hash)
              │ window.api.languageLearningOpen
              ▼
main: language-learning-service ─▶ processing worker: prepareLearningDocument
              │   import source into <userData>/language-learning/packages/<hash>.lyceum (once)
              │   analyze text with the language module ─▶ indexes/linguistic/document.json
              ▼
renderer: LinguisticDocument + OccurrenceIndex  ◀──  SQLite user data (ll_* tables)
```

## Strict separation of data

| Document data (immutable, per document version) | User learning data (per user) |
| --- | --- |
| `.lyceum` package: text, structure, stable ids, tokens, lemmas, forms, expressions, chapter statistics | SQLite `ll_knowledge`, `ll_form_knowledge`, `ll_review_items`, `ll_review_log`, `ll_annotations`, `ll_reading_state` |

User data is keyed by `userId` (Supabase user id, or `local`) + language +
lemma key, so knowledge carries across books and never touches the package.
The document language comes from the text itself (`languages/detect.ts`)
before book metadata, because imports default a missing language and a wrong
label would file vocabulary under the wrong language. If vocabulary already
sits under another label (or the signed-out profile) and overlaps the open
book, the reader offers to merge it (`mergeKnowledge`).

### Durability

- Every change is written to SQLite immediately (optimistic UI, reverted with
  an error toast on failure); the toolbar shows saving / saved / not saved.
- After each change the main process writes a JSON backup outside the
  database (`<userData>/language-learning/backups/<user>/latest.json` plus one
  file per day, 30 days kept). An empty export never overwrites a backup.
- Export / import (`lyceum.learning-backup` v1) from the Words panel; import
  merges, keeping the most recently updated version of each record.
`.lyceum` packages from the library are never modified (their directory hash
is their identity). Their index is written to a cache sidecar
(`<userData>/language-learning/indexes/<hash>/document.json`) unless the
package already ships a compatible one.

## `.lyceum` format extension: `indexes/linguistic/document.json`

Schema `lyceum.linguistic`, version 1 (`src/core/language-learning/model.ts`):

- `chapters[] → blocks[] → sentences[] → tokens[]`, with stable ids
  `"<spineId>"`, `"<chapterId>.b<n>"`, `"<blockId>.s<n>"`, and token ids
  `"<sentenceId>.t<n>"`.
- Tokens are compact tuples `[start, end, lexemeIndex, formIndex, flags]`. The
  offsets position the token inside its block text; identity comes from the ids.
- `lexicon[]`: lemma key, lemma, POS, lemma features (e.g. gender, compound),
  `estimated` flag, and count.
- `forms[]`: lower-cased surface form → lexeme, inflectional features, count.
- `expressions[]` + `expressionOccurrences[]` (token indexes inside sentences,
  which may be discontinuous).
- `chapterStats[]` (lexeme counts per chapter), `totals`, and analyzer
  `{ module, moduleVersion, capabilities }`. When the module id or version
  changes, the index is rebuilt automatically.

The manifest schema is unchanged; the index is optional, so older packages
still work.

## Language modules

`src/core/language-learning/languages/`. The core is language-agnostic, and a
module declares its capabilities:

- `generic`: `Intl.Segmenter` sentence/word segmentation (also for CJK).
  es/pt/fr/it/nl add suffix stripping, but only when the shorter form is
  attested in the same book and the word is not a listed invariable word
  ("vous", "dans", "mais"…). fr/it/ca split elisions ("l'écran" → "l'" +
  "écran").
- `de-rules`: closed-class lexicon, strong/mixed and modal verb paradigms,
  separable and inseparable prefixes, attestation-based weak verbs and noun
  plurals, compound splitting, noun gender inferred from articles in the
  book, separable/reflexive constructions, gapped expressions, and a
  clause/case/verb-position analysis that is labeled as uncertain.
- `en-rules`: irregular forms, attestation-based suffix rules, phrasal verbs.

Lemmas guessed by rules are flagged `estimated` and shown as such in the UI.

## Providers (optional, never required for reading)

- Translation (`src/features/language-learning/translation.ts`): offline
  bilingual dictionaries (existing dictionary manager; exact pair, else
  source → English) first, then MyMemory
  through the main process. MyMemory is **opt-in** because it sends text off
  the device. With no provider, the UI shows an unavailable state.
- Speech (`speech.ts`): the system Web Speech voices. When the OS has no voice
  for the language, audio is reported as unavailable.
- AI tutor (`src/core/language-learning/tutor.ts`): interface and context
  builder only. No provider is bundled.

## Reader UI notes

- Long chapters are rendered in segments of ~700 words; only segments near
  the viewport are in the DOM (IntersectionObserver), unmounted ones keep
  their measured height.
- Learning is the vocabulary: setting a word (or expression) to Learning
  creates its review card, and the review queue only contains words that are
  currently Learning. There is no separate "add to vocabulary" action.
- Clicking an unknown word in the text sets it to Learning (setting, on by
  default, no toast). Ctrl/Cmd+click marks a word Known without opening the
  panel. Keyboard navigation and list clicks only inspect.
- Right-click menu: knowledge state, open in side panel, add note, copy.
- Both side panels are resizable from their left edge (shared
  `useResizablePanel` + `PanelResizeHandle`, also used by the PDF chapter
  sidebar); widths are remembered.
- The reading surface follows the app theme tokens; Sepia is the only fixed
  paper tone. Save status lives in the panel footer; the toolbar only shows
  a warning when a change could not be saved.
- The Words tab lists every word of the chapter, the book, or all saved words
  of the language, sortable by relevance, frequency, A–Z or recent change,
  with per-row state buttons and bulk actions.

## Dictionaries

The dictionary catalog combines the curated Lyceum list with every FreeDict
StarDict release (`electron/services/freedict-snapshot.ts`, refreshed from
freedict.org by "Refresh" in settings). Downloads are checked against the
FreeDict SHA-512 checksum. The reader offers the matching dictionary when a
word has no translation source.

## Mobile (Capacitor)

The phone app runs the same reader with platform services injected through
`src/platform` (`registerCapacitorPlatform()` in `src/mobile/main.tsx`).

| Concern | Desktop | Mobile |
| --- | --- | --- |
| Session logic | `useLearningSessionCore` (shared) | same |
| Text surface | `ReadingSurface` | same, `touch` mode: tap = inspect, double tap = Known, long-press selection = phrase |
| Book preparation | main-process worker, `.lyceum` package | `features/language-learning/browser/*`: EPUB/TXT read with JSZip + `DOMParser`, analysis in a Web Worker, cached in IndexedDB (`lyceum-learning-documents`) |
| Language choice | `chooseDocumentLanguage` (shared, `lib/lyceum/linguistic/language.ts`) | same |
| Vocabulary store | SQLite (`sqlite-language-learning-repository.ts`) | `createMemoryLanguageLearningRepository` (same contract tests) + IndexedDB journal (`platform/web/learningDatabase.ts`) |
| Automatic backups | `<userData>/language-learning/backups` | `Documents/Lyceum/Vocabulario/<user>/latest.json` + daily copies (30), never overwritten by an empty export |
| Dictionaries | `electron/dictionary-*` | `platform/web/dictionaryStore.ts`: same catalog (`core/dictionaries`), StarDict parsed in JS, tar.xz via `xz-decompress`, downloads through native HTTP |
| Online translation | MyMemory via main process | MyMemory via `CapacitorHttp` (`features/language-learning/myMemory.ts`, opt-in) |

Backups use one format (`lyceum.learning-backup` v1) on both platforms, so a
desktop export can be imported on the phone (Profile → Vocabulary) and vice
versa; the newest version of each record wins.

Mobile-only reading aid: at the end of a chapter, "Mark the N remaining words
as known" sets the chapter's untouched Unknown words (no numbers, no likely
proper names) to Known, with undo.

Not yet on mobile: PDF/HTML sources and cloud sync of vocabulary between devices.
