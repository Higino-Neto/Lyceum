import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { OccurrenceIndex } from "../../core/language-learning";
import { analyzeBook } from "../../features/language-learning/browser/analyzeBook";
import { readTextChapters } from "../../features/language-learning/browser/sourceChapters";
import { DEFAULT_LEARNING_SETTINGS } from "../../features/language-learning/settings";
import { ReadingSurface } from "../../pages/ReadingPage/components/lyceum-reader/ReadingSurface";

function renderSurface(touch: boolean) {
  const book = readTextChapters(new TextEncoder().encode("Le chat dort dans la maison. Il fait beau aujourd'hui."), "Livre");
  const { document } = analyzeBook({ documentId: "d", book, language: "fr" });
  const onWordClick = vi.fn();
  const utils = render(
    <ReadingSurface
      touch={touch}
      document={document}
      index={new OccurrenceIndex(document)}
      chapterIndex={0}
      formStates={[]}
      settings={DEFAULT_LEARNING_SETTINGS}
      decorations={{ selectedOrdinal: null, relatedLexeme: null, expressionOrdinals: [], selectedSentenceId: null, speakingSentenceId: null, speakingOrdinal: null, grammarRoles: new Map(), annotatedIds: new Set() }}
      scrollTarget={null}
      initialBlockId={null}
      onWordClick={onWordClick}
      onWordContextMenu={vi.fn()}
      onSentenceClick={vi.fn()}
      onRangeSelect={vi.fn()}
      onBackgroundClick={vi.fn()}
      onPosition={vi.fn()}
    />,
  );
  const word = utils.container.querySelector<HTMLElement>(".lx-w")!;
  return { onWordClick, word };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("reading surface on touch screens", () => {
  it("inspects a word after a short delay on a single tap", () => {
    vi.useFakeTimers();
    const { onWordClick, word } = renderSurface(true);
    fireEvent.click(word);
    expect(onWordClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onWordClick).toHaveBeenCalledWith(Number(word.dataset.o), { alt: false, ctrl: false });
  });

  it("treats a double tap like Ctrl+click (mark Known) and does not also inspect", () => {
    vi.useFakeTimers();
    const { onWordClick, word } = renderSurface(true);
    fireEvent.click(word);
    fireEvent.click(word);
    vi.advanceTimersByTime(300);
    expect(onWordClick).toHaveBeenCalledTimes(1);
    expect(onWordClick).toHaveBeenCalledWith(Number(word.dataset.o), { alt: false, ctrl: true });
  });

  it("keeps the immediate click behaviour on desktop", () => {
    const { onWordClick, word } = renderSurface(false);
    fireEvent.click(word);
    expect(onWordClick).toHaveBeenCalledWith(Number(word.dataset.o), { alt: false, ctrl: false });
  });
});
