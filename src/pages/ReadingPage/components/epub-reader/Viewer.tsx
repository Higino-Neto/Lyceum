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
} from "lucide-react";
import toast from "react-hot-toast";
import ViewerCore from "./ViewerCore";
import ReaderToolbar from "./ReaderToolbar";
import VocabularyPanel from "./VocabularyPanel";
import { useReaderSettings } from "./useReaderSettings";
import {
  DictionaryLookupResult,
  fetchDictionaryEntry,
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
  translation: string | null;
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

function LearningDock({
  title,
  subtitle,
  actions,
  children,
  onClose,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <aside className="pointer-events-auto absolute inset-x-3 bottom-3 z-30 flex h-[min(60%,520px)] min-h-[280px] flex-col overflow-hidden rounded-sm border border-zinc-800 bg-zinc-900 shadow-2xl lg:inset-x-auto lg:right-4 lg:top-4 lg:bottom-4 lg:h-auto lg:min-h-0 lg:w-[380px]">
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

      {actions ? (
        <div className="border-b border-zinc-800 px-4 py-3">{actions}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {children}
      </div>
    </aside>
  );
}

export default function Viewer({ epubData, fileHash, fileName }: ViewerProps) {
  const overlayHostRef = useRef<HTMLDivElement>(null);
  const [isVocabularyPanelOpen, setIsVocabularyPanelOpen] = useState(false);
  const [vocabularyFilter, setVocabularyFilter] =
    useState<VocabularyFilter>("all");
  const [activeWordLookup, setActiveWordLookup] =
    useState<ActiveWordLookup | null>(null);
  const [activeSelectionLookup, setActiveSelectionLookup] =
    useState<ActiveSelectionLookup | null>(null);
  const {
    settings,
    setFontSize,
    setTheme,
    setFontFamily,
    setLineHeight,
    setContentWidth,
    setSourceLanguage,
    setTargetLanguage,
    setShowHighlights,
    setShowPages,
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
  const wordLookupAbortRef = useRef<AbortController | null>(null);
  const selectionLookupAbortRef = useRef<AbortController | null>(null);
  const overlayScrollThreshold = 120;

  useEffect(() => {
    setIsVocabularyPanelOpen(false);
    setVocabularyFilter("all");
    setActiveWordLookup(null);
    setActiveSelectionLookup(null);
  }, [fileHash]);

  useEffect(() => {
    return () => {
      wordLookupAbortRef.current?.abort();
      selectionLookupAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setActiveWordLookup(null);
      setActiveSelectionLookup(null);
      setIsVocabularyPanelOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

    setActiveWordLookup({
      anchor,
      displayWord,
      normalizedWord,
      originScrollTop: scrollTop,
      isLoading: !cachedDictionary || !cachedTranslation,
      error: null,
      dictionary: cachedDictionary,
      translation: cachedTranslation,
    });

    if (cachedDictionary && cachedTranslation) {
      return;
    }

    wordLookupAbortRef.current?.abort();
    const controller = new AbortController();
    wordLookupAbortRef.current = controller;

    const [dictionaryResult, translationResult] = await Promise.allSettled([
      cachedDictionary
        ? Promise.resolve(cachedDictionary)
        : fetchDictionaryEntry(normalizedWord, controller.signal, settings.sourceLanguage),
      cachedTranslation
        ? Promise.resolve({ translatedText: cachedTranslation })
        : translateText(normalizedWord, settings.sourceLanguage, settings.targetLanguage, controller.signal),
    ]);

    if (controller.signal.aborted) {
      return;
    }

    const resolvedDictionary =
      dictionaryResult.status === "fulfilled"
        ? dictionaryResult.value
        : cachedDictionary;
    const resolvedTranslation =
      translationResult.status === "fulfilled"
        ? translationResult.value.translatedText
        : cachedTranslation;
    const error =
      dictionaryResult.status === "rejected" && translationResult.status === "rejected"
        ? "Nao foi possivel carregar definicao ou traducao agora."
        : null;

    if (resolvedDictionary) {
      dictionaryCacheRef.current.set(normalizedWord, resolvedDictionary);
    }

    if (resolvedTranslation) {
      wordTranslationCacheRef.current.set(normalizedWord, resolvedTranslation);
    }

    setActiveWordLookup((current) => {
      if (!current || current.normalizedWord !== normalizedWord) {
        return current;
      }

      return {
        ...current,
        isLoading: false,
        error,
        dictionary: resolvedDictionary || null,
        translation: resolvedTranslation || null,
      };
    });
  };

  const handleSelection = ({
    selectedText,
    anchor,
    scrollTop,
  }: TextSelectionPayload) => {
    setActiveWordLookup(null);
    setActiveSelectionLookup({
      anchor,
      selectedText,
      originScrollTop: scrollTop,
      activeAction: null,
      isLoading: false,
      error: null,
      translation: null,
      simplifiedText: null,
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

  const runSelectionAction = async (action: "translate" | "simplify") => {
    if (!activeSelectionLookup) return;

    selectionLookupAbortRef.current?.abort();
    const controller = new AbortController();
    selectionLookupAbortRef.current = controller;

    setActiveSelectionLookup((current) =>
      current
        ? {
            ...current,
            activeAction: action,
            isLoading: true,
            error: null,
          }
        : current,
    );

    try {
      if (action === "translate") {
        const result = await translateText(
          activeSelectionLookup.selectedText,
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

        return;
      }

      const simplifiedText = await simplifySelectedText(
        activeSelectionLookup.selectedText,
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
      <ReaderToolbar
        settings={settings}
        isVocabularyPanelOpen={isVocabularyPanelOpen}
        onFontSizeChange={setFontSize}
        onThemeChange={setTheme}
        onFontFamilyChange={setFontFamily}
        onLineHeightChange={setLineHeight}
        onContentWidthChange={setContentWidth}
        onToggleVocabularyPanel={() =>
          setIsVocabularyPanelOpen((current) => !current)
        }
        onSourceLanguageChange={setSourceLanguage}
        onTargetLanguageChange={setTargetLanguage}
        onShowHighlightsChange={setShowHighlights}
        onShowPagesChange={setShowPages}
      />

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
        />

        {activeWordLookup && (
          <LearningDock
            title={activeWordLookup.displayWord}
            subtitle={
              <>
                {activeWordLookup.dictionary?.partOfSpeech && (
                  <span>{activeWordLookup.dictionary.partOfSpeech}</span>
                )}
                {activeWordLookup.dictionary?.phonetic && (
                  <span>{activeWordLookup.dictionary.phonetic}</span>
                )}
              </>
            }
            actions={
              <div className="flex flex-wrap gap-2">
                {(["new", "learning", "known"] as VocabularyStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`rounded-sm px-3 py-1.5 text-sm transition ${
                      activeWordEntry?.status === status
                        ? getVocabularyStatusClasses(status)
                        : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                    }`}
                    onClick={() =>
                      setWordStatus(
                        activeWordLookup.normalizedWord,
                        status,
                        activeWordLookup.displayWord,
                      )
                    }
                  >
                    {getVocabularyStatusLabel(status)}
                  </button>
                ))}

                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition ${
                    activeWordEntry?.saved
                      ? "border border-yellow-300/30 bg-yellow-400/10 text-yellow-100"
                      : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                  onClick={() =>
                    toggleWordSaved(
                      activeWordLookup.normalizedWord,
                      activeWordLookup.displayWord,
                    )
                  }
                >
                  <Bookmark
                    size={14}
                    fill={activeWordEntry?.saved ? "currentColor" : "none"}
                  />
                  {activeWordEntry?.saved ? "Salva" : "Salvar"}
                </button>

                {activeWordLookup.dictionary?.audioUrl && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-800"
                    onClick={() =>
                      handlePlayPronunciation(activeWordLookup.dictionary?.audioUrl)
                    }
                  >
                    <Play size={14} />
                    Ouvir
                  </button>
                )}
              </div>
            }
            onClose={handleDismissOverlays}
          >
            {activeWordLookup.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <LoaderCircle size={16} className="animate-spin" />
                Buscando definicao e traducao...
              </div>
            ) : (
              <div className="space-y-3">
                {activeWordLookup.translation && (
                  <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Traducao PT-BR
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-100">
                      {activeWordLookup.translation}
                    </p>
                  </div>
                )}

                {activeWordLookup.dictionary?.definitions?.length ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Definicao em ingles
                    </p>
                    {activeWordLookup.dictionary.definitions.map((definition, index) => (
                      <div
                        key={`${activeWordLookup.normalizedWord}-${index}`}
                        className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3"
                      >
                        <p className="text-sm leading-6 text-zinc-100">
                          {definition.definition}
                        </p>
                        {definition.example && (
                          <p className="mt-2 text-xs italic text-zinc-400">
                            {definition.example}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                {activeWordLookup.error && (
                  <div className="rounded-sm border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-100">
                    {activeWordLookup.error}
                  </div>
                )}
              </div>
            )}
          </LearningDock>
        )}

        {activeSelectionLookup && (
          <LearningDock
            title="Trecho selecionado"
            subtitle={<span className="line-clamp-2">{activeSelectionLookup.selectedText}</span>}
            actions={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition ${
                    activeSelectionLookup.activeAction === "translate"
                      ? "border border-blue-300/30 bg-blue-500/10 text-blue-100"
                      : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                  onClick={() => runSelectionAction("translate")}
                >
                  <Languages size={14} />
                  Traduzir
                </button>

                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition ${
                    activeSelectionLookup.activeAction === "simplify"
                      ? "border border-zinc-600 bg-zinc-800 text-zinc-100"
                      : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                  onClick={() => runSelectionAction("simplify")}
                >
                  <Sparkles size={14} />
                  Simplificar
                </button>
              </div>
            }
            onClose={handleDismissOverlays}
          >
            {activeSelectionLookup.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <LoaderCircle size={16} className="animate-spin" />
                Processando trecho...
              </div>
            ) : (
              <div className="space-y-3">
                {activeSelectionLookup.translation && (
                  <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Traducao PT-BR
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-100">
                      {activeSelectionLookup.translation}
                    </p>
                  </div>
                )}

                {activeSelectionLookup.simplifiedText && (
                  <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Versao simplificada
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-100">
                      {activeSelectionLookup.simplifiedText}
                    </p>
                  </div>
                )}

                {activeSelectionLookup.error && (
                  <div className="rounded-sm border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-100">
                    {activeSelectionLookup.error}
                  </div>
                )}
              </div>
            )}
          </LearningDock>
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
      </div>
    </div>
  );
}
