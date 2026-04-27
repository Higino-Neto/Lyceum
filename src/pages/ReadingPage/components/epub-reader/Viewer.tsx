import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bookmark,
  LoaderCircle,
  Play,
  Sparkles,
  Languages,
  X,
  Focus,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import ViewerCore, { NavItem } from "./ViewerCore";
import ReaderToolbar from "./ReaderToolbar";
import VocabularyPanel from "./VocabularyPanel";
import TableOfContents from "./TableOfContents";
import { useReaderSettings } from "./useReaderSettings";
import {
  DictionaryLookupResult,
  lookupWord,
  lookupWithTranslation,
  simplifySelectedText,
  translateText,
} from "./languageServices";
import {
  LearningOverlayAnchor,
  TextSelectionPayload,
  VocabularyStatus,
  WordInteractionPayload,
  getVocabularyStatusClasses,
  getVocabularyStatusLabel,
} from "./languageLearning";
import useBookVocabulary from "./useBookVocabulary";

interface ViewerProps {
  epubData: ArrayBuffer;
  fileHash: string;
  fileName?: string;
}

interface ActiveWordLookup {
  anchor: LearningOverlayAnchor;
  displayWord: string;
  normalizedWord: string;
  originScrollTop: number;
  isLoading: boolean;
  error: string | null;
  dictionary: DictionaryLookupResult | null;
  translatedDictionary: DictionaryLookupResult | null;
  translation: string | null;
  wordCount?: number;
}

interface ActiveSelectionLookup {
  anchor: LearningOverlayAnchor;
  selectedText: string;
  originScrollTop: number;
  activeAction: "translate" | "simplify" | null;
  isLoading: boolean;
  error: string | null;
  translation: string | null;
  simplifiedText: string | null;
}

type VocabularyFilter = "all" | "learning" | "known";

function escapeCsvValue(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function buildCsv(entries: Array<{
  displayWord: string;
  normalizedWord: string;
  status: string;
  saved: boolean;
  updatedAt: number;
}>) {
  const header = ["word", "normalized_word", "status", "saved", "updated_at"];
  const rows = entries.map((entry) => [
    entry.displayWord,
    entry.normalizedWord,
    entry.status,
    String(entry.saved),
    new Date(entry.updatedAt).toISOString(),
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\r\n");
}

function sanitizeExportFileName(fileName?: string) {
  const baseName = (fileName || "book")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${baseName || "book"}-vocabulary.csv`;
}

function TranslationCard({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-100">{text}</p>
    </div>
  );
}

function DictionaryMeanings({
  dictionary,
  translatedDictionary,
}: {
  dictionary?: DictionaryLookupResult | null;
  translatedDictionary?: DictionaryLookupResult | null;
}) {
  if (!translatedDictionary?.meanings?.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Traducoes</p>
      {translatedDictionary.meanings.map((meaning, mi) => (
        <div key={`trans-meaning-${mi}`}>
          {meaning.partOfSpeech !== "dictionary" && (
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-400 mb-2">
              {meaning.partOfSpeech}
            </p>
          )}
          <ul className="space-y-1">
            {meaning.definitions.map((definition, di) => {
              const sourceDef = dictionary?.meanings?.[mi]?.definitions?.[di];
              return (
                <li key={`def-${mi}-${di}`} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                  <div className="flex-1">
                    <span className="text-sm text-zinc-100">{definition.definition}</span>
                    {sourceDef?.example && (
                      <p className="mt-1 text-xs italic text-zinc-500">"{sourceDef.example}"</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TranslationDock({
  title,
  subtitle,
  isLoading,
  translation,
  simplifiedText,
  translatedDictionary,
  dictionary,
  error,
  targetLanguage,
  onClose,
}: {
  title: string;
  subtitle?: ReactNode;
  isLoading: boolean;
  translation?: string | null;
  simplifiedText?: string | null;
  translatedDictionary?: DictionaryLookupResult | null;
  dictionary?: DictionaryLookupResult | null;
  error?: string | null;
  targetLanguage: string;
  onClose: () => void;
}) {
  return (
    <LearningDock title={title} subtitle={subtitle} onClose={onClose}>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <LoaderCircle size={16} className="animate-spin" />
          Processando...
        </div>
      ) : (
        <div className="space-y-3">
          {translation && (
            <TranslationCard label={`Traducao (${targetLanguage.toUpperCase()})`} text={translation} />
          )}
          {simplifiedText && (
            <TranslationCard label="Versao simplificada" text={simplifiedText} />
          )}
          <DictionaryMeanings dictionary={dictionary} translatedDictionary={translatedDictionary} />
          {error && (
            <div className="rounded-sm border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-100">
              {error}
            </div>
          )}
        </div>
      )}
    </LearningDock>
  );
}

function LearningDock({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <aside className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 flex max-h-[70vh] min-h-[200px] flex-col overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl lg:inset-x-auto lg:right-4 lg:top-4 lg:bottom-4 lg:h-auto lg:min-h-0 lg:w-[380px]">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-zinc-100">{title}</p>
          {subtitle ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              {subtitle}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="rounded-sm p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          onClick={onClose}
          title="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {children}
      </div>
    </aside>
  );
}

export default function Viewer({ epubData, fileHash, fileName }: ViewerProps) {
  const overlayHostRef = useRef<HTMLDivElement>(null);
  const [isVocabularyPanelOpen, setIsVocabularyPanelOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentSectionHref, setCurrentSectionHref] = useState<string | undefined>();
  const [readingProgress, setReadingProgress] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);
  const [vocabularyFilter, setVocabularyFilter] =
    useState<VocabularyFilter>("all");
  const [activeWordLookup, setActiveWordLookup] =
    useState<ActiveWordLookup | null>(null);
  const [activeSelectionLookup, setActiveSelectionLookup] =
    useState<ActiveSelectionLookup | null>(null);
  const {
    setFontSize,
    setTheme,
    setFontFamily,
    setLineHeight,
    setContentWidth,
    setSourceLanguage,
    setTargetLanguage,
    setShowHighlights,
    setShowPages,
    setFocusMode,
    settings,
  } = useReaderSettings();
  const {
    entries,
    trackedEntries,
    stats,
    ensureWord,
    setWordStatus,
    cycleWordStatusInverse,
    toggleWordSaved,
    setIndexedWordCount,
  } = useBookVocabulary(fileHash);
  const dictionaryCacheRef = useRef(new Map<string, DictionaryLookupResult>());
  const wordTranslationCacheRef = useRef(new Map<string, string>());
  const selectionTranslationCacheRef = useRef(new Map<string, string>());
  const wordLookupAbortRef = useRef<AbortController | null>(null);
  const selectionLookupAbortRef = useRef<AbortController | null>(null);
  const overlayScrollThreshold = 120;

  useEffect(() => {
    setIsVocabularyPanelOpen(false);
    setIsTocOpen(false);
    setToc([]);
    setVocabularyFilter("all");
    setActiveWordLookup(null);
    setActiveSelectionLookup(null);
  }, [fileHash]);

  useEffect(() => {
    if (settings.focusMode) {
      setIsVocabularyPanelOpen(false);
      setIsTocOpen(false);
      setActiveWordLookup(null);
      setActiveSelectionLookup(null);
    }
  }, [settings.focusMode]);

  useEffect(() => {
    dictionaryCacheRef.current.clear();
    wordTranslationCacheRef.current.clear();
    selectionTranslationCacheRef.current.clear();
    setActiveWordLookup(null);
    setActiveSelectionLookup(null);
  }, [settings.sourceLanguage, settings.targetLanguage]);

  useEffect(() => {
    return () => {
      wordLookupAbortRef.current?.abort();
      selectionLookupAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (settings.focusMode) {
        setFocusMode(false);
        return;
      }

      setActiveWordLookup(null);
      setActiveSelectionLookup(null);
      setIsVocabularyPanelOpen(false);
      setIsTocOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.focusMode, setFocusMode]);

  const handleDismissOverlays = () => {
    setActiveWordLookup(null);
    setActiveSelectionLookup(null);
  };

  const handleWordClick = async ({
    displayWord,
    normalizedWord,
  }: WordInteractionPayload) => {
    ensureWord(normalizedWord, displayWord);
    setActiveSelectionLookup(null);
    cycleWordStatusInverse(normalizedWord, displayWord);
    setActiveWordLookup(null);
  };

  const handleWordRightClick = async ({
    displayWord,
    normalizedWord,
    anchor,
    scrollTop,
  }: WordInteractionPayload) => {
    ensureWord(normalizedWord, displayWord);
    setActiveSelectionLookup(null);

    const cachedDictionary = dictionaryCacheRef.current.get(normalizedWord) || null;
    const cachedTranslation =
      wordTranslationCacheRef.current.get(normalizedWord) || null;

    const wordCountResult = await (window.api as any).getWordCount(fileHash, normalizedWord).catch(() => null);

    setActiveWordLookup({
      anchor,
      displayWord,
      normalizedWord,
      originScrollTop: scrollTop,
      isLoading: true,
      error: null,
      dictionary: cachedDictionary,
      translatedDictionary: null,
      translation: cachedTranslation,
      wordCount: wordCountResult?.count || null,
    });

    wordLookupAbortRef.current?.abort();
    const controller = new AbortController();
    wordLookupAbortRef.current = controller;

    try {
      const { source, translated } = await lookupWithTranslation(
        normalizedWord,
        settings.sourceLanguage,
        settings.targetLanguage,
        controller.signal,
      );

if (controller.signal.aborted) return;

      dictionaryCacheRef.current.set(normalizedWord, source);

      const translationResult = await translateText(
        normalizedWord,
        settings.sourceLanguage,
        settings.targetLanguage,
        controller.signal,
      ).catch(() => null);

      if (translationResult?.translatedText) {
        wordTranslationCacheRef.current.set(normalizedWord, translationResult.translatedText);
      }

      setActiveWordLookup((current) => {
        if (!current || current.normalizedWord !== normalizedWord) return current;
        return {
          ...current,
          isLoading: false,
          dictionary: source,
          translatedDictionary: translated,
          translation: translationResult?.translatedText || cachedTranslation || null,
        };
      });
} catch (err) {
      if (controller.signal.aborted) return;

      const fallbackTranslation = wordTranslationCacheRef.current.get(normalizedWord) || null;

      setActiveWordLookup((current) => {
        if (!current || current.normalizedWord !== normalizedWord) return current;
        return {
          ...current,
          isLoading: false,
          error: err instanceof Error ? err.message : "Erro ao carregar definicoes",
          translation: fallbackTranslation || current.translation || null,
        };
      });
    }
  };

  const handleSelection = ({
    selectedText,
    anchor,
    scrollTop,
  }: TextSelectionPayload) => {
    const cacheKey = `${settings.sourceLanguage}:${settings.targetLanguage}:${selectedText}`;
    const cachedTranslation = selectionTranslationCacheRef.current.get(cacheKey) || null;

    setActiveWordLookup(null);
    setActiveSelectionLookup({
      anchor,
      selectedText,
      originScrollTop: scrollTop,
      activeAction: "translate",
      isLoading: true,
      error: null,
      translation: cachedTranslation,
      simplifiedText: null,
    });

    selectionLookupAbortRef.current?.abort();
    const controller = new AbortController();
    selectionLookupAbortRef.current = controller;

    translateText(
      selectedText,
      settings.sourceLanguage,
      settings.targetLanguage,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.translatedText) {
          selectionTranslationCacheRef.current.set(cacheKey, result.translatedText);
        }
        setActiveSelectionLookup((current) =>
          current && current.anchor === anchor
            ? {
                ...current,
                isLoading: false,
                translation: result.translatedText || cachedTranslation || null,
              }
            : current,
        );
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setActiveSelectionLookup((current) =>
          current && current.anchor === anchor
            ? {
                ...current,
                isLoading: false,
                error: err instanceof Error ? err.message : "Erro ao traduzir",
              }
            : current,
        );
      });
  };

  const handleViewerScroll = (scrollTop: number) => {
    setActiveWordLookup((current) =>
      current && Math.abs(scrollTop - current.originScrollTop) > overlayScrollThreshold
        ? null
        : current,
    );
    setActiveSelectionLookup((current) =>
      current && Math.abs(scrollTop - current.originScrollTop) > overlayScrollThreshold
        ? null
        : current,
    );
  };

  const handleScrollPositionChange = (_scrollTop: number) => {};

  const handleProgressChange = (percentage: number, total?: number) => {
    setReadingProgress(percentage);
    if (total !== undefined && total > 0) {
      setTotalLocations(total);
      setCurrentLocation(Math.round(total * (percentage / 100)));
    }
  };

  const runSelectionAction = async (action: "translate" | "simplify", text: string) => {
    if (!activeSelectionLookup) {
      return;
    }

    selectionLookupAbortRef.current?.abort();
    const controller = new AbortController();
    selectionLookupAbortRef.current = controller;

    try {
      if (action === "translate") {
        try {
          const result = await translateText(
            text,
            settings.sourceLanguage,
            settings.targetLanguage,
            controller.signal,
          );

          if (controller.signal.aborted) return;

          setActiveSelectionLookup((current) =>
            current
              ? {
                  ...current,
                  activeAction: action,
                  isLoading: false,
                  translation: result.translatedText,
                }
              : current,
          );
        } catch (err) {
          if (controller.signal.aborted) return;
          setActiveSelectionLookup((current) =>
            current
              ? {
                  ...current,
                  isLoading: false,
                  error: err instanceof Error ? err.message : "Erro ao traduzir",
                }
              : current,
          );
        }

        return;
      }

      const simplifiedText = await simplifySelectedText(
        text,
        controller.signal,
        settings.sourceLanguage,
        settings.targetLanguage,
      );

      if (controller.signal.aborted) return;

      setActiveSelectionLookup((current) =>
        current
          ? {
              ...current,
              activeAction: action,
              isLoading: false,
              simplifiedText,
            }
          : current,
      );
    } catch (error) {
      if (controller.signal.aborted) return;

      setActiveSelectionLookup((current) =>
        current
          ? {
              ...current,
              isLoading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Nao foi possivel processar este trecho agora.",
            }
          : current,
      );
    }
  };

  const handlePlayPronunciation = async (audioUrl?: string) => {
    if (!audioUrl) return;

    try {
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch {
      toast.error("Nao foi possivel reproduzir o audio.");
    }
  };

  const handleExportCsv = () => {
    if (!trackedEntries.length) {
      toast.error("Nenhuma palavra rastreada para exportar.");
      return;
    }

    const csv = buildCsv(trackedEntries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sanitizeExportFileName(fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  const activeWordEntry = activeWordLookup
    ? entries[activeWordLookup.normalizedWord]
    : null;

  const visibleVocabularyEntries = useMemo(
    () =>
      trackedEntries.filter((entry) => {
        if (vocabularyFilter === "all") return true;
        return entry.status === vocabularyFilter;
      }),
    [trackedEntries, vocabularyFilter],
  );

  return (
    <div className="w-full h-full flex flex-col">
      {!settings.focusMode && (
        <ReaderToolbar
          settings={settings}
          isVocabularyPanelOpen={isVocabularyPanelOpen}
          isTocOpen={isTocOpen}
          readingProgress={readingProgress}
          currentLocation={currentLocation}
          totalLocations={totalLocations}
          onFontSizeChange={setFontSize}
          onThemeChange={setTheme}
          onFontFamilyChange={setFontFamily}
          onLineHeightChange={setLineHeight}
          onContentWidthChange={setContentWidth}
          onToggleVocabularyPanel={() =>
            setIsVocabularyPanelOpen((current) => !current)
          }
          onToggleToc={() => setIsTocOpen((current) => !current)}
          onSourceLanguageChange={setSourceLanguage}
          onTargetLanguageChange={setTargetLanguage}
          onShowHighlightsChange={setShowHighlights}
          onShowPagesChange={setShowPages}
          onFocusModeChange={setFocusMode}
        />
      )}

      {settings.focusMode && (
        <div className="absolute top-2 right-2 z-50 opacity-0 hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className="flex items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition"
            title="Sair do Modo Foco (Esc)"
          >
            <Focus size={16} />
            Sair
          </button>
        </div>
      )}

      <div ref={overlayHostRef} className="relative flex-1 min-h-0 overflow-hidden">
        <ViewerCore
          epubData={epubData}
          fileHash={fileHash}
          settings={settings}
          vocabularyEntries={entries}
          onWordClick={handleWordClick}
          onWordRightClick={handleWordRightClick}
          onTextSelection={handleSelection}
          onVocabularyIndex={setIndexedWordCount}
          onDismissOverlays={handleDismissOverlays}
          onViewerScroll={handleViewerScroll}
          onScrollPositionChange={handleScrollPositionChange}
          onProgressChange={handleProgressChange}
          onNavigationLoaded={setToc}
          onNavigateToChapter={(href) => setCurrentSectionHref(href)}
          currentSectionHref={currentSectionHref}
        />

        {activeWordLookup && (
          <TranslationDock
            title={activeWordLookup.displayWord}
            subtitle={
              <>
                {activeWordLookup.translatedDictionary?.meanings?.[0]?.partOfSpeech && (
                  <span>{activeWordLookup.translatedDictionary.meanings[0].partOfSpeech}</span>
                )}
                {activeWordLookup.dictionary?.phonetic && (
                  <span>{activeWordLookup.dictionary.phonetic}</span>
                )}
                {activeWordLookup.wordCount !== null && activeWordLookup.wordCount !== undefined && (
                  <span className="ml-2 text-zinc-500">
                    {activeWordLookup.wordCount.toLocaleString()} {activeWordLookup.wordCount === 1 ? "vez" : "vezes"}
                  </span>
                )}
              </>
            }
            isLoading={activeWordLookup.isLoading}
            translation={activeWordLookup.translation}
            dictionary={activeWordLookup.dictionary}
            translatedDictionary={activeWordLookup.translatedDictionary}
            error={activeWordLookup.error}
            targetLanguage={settings.targetLanguage}
            onClose={handleDismissOverlays}
          />
        )}

        {activeSelectionLookup && (
          <TranslationDock
            title="Trecho selecionado"
            subtitle={<span className="line-clamp-2">{activeSelectionLookup.selectedText}</span>}
            isLoading={activeSelectionLookup.isLoading}
            translation={activeSelectionLookup.translation}
            simplifiedText={activeSelectionLookup.simplifiedText}
            error={activeSelectionLookup.error}
            targetLanguage={settings.targetLanguage}
            onClose={handleDismissOverlays}
          />
        )}

        <VocabularyPanel
          isOpen={isVocabularyPanelOpen}
          fileName={fileName}
          entries={visibleVocabularyEntries}
          stats={stats}
          filter={vocabularyFilter}
          onFilterChange={setVocabularyFilter}
          onStatusChange={(word, status) => setWordStatus(word, status)}
          onToggleSaved={(word) => toggleWordSaved(word)}
          onExportCsv={handleExportCsv}
          onClose={() => setIsVocabularyPanelOpen(false)}
        />

        <TableOfContents
          isOpen={isTocOpen}
          toc={toc}
          currentHref={currentSectionHref}
          onSelectChapter={(href) => {
            setCurrentSectionHref(href);
            setIsTocOpen(false);
          }}
          onClose={() => setIsTocOpen(false)}
        />
      </div>
    </div>
  );
}
