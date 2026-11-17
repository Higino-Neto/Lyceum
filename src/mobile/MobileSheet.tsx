import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface MobileSheetProps {
  open: boolean;
  title?: ReactNode;
  onClose(): void;
  children: ReactNode;
  /** "auto" hugs the content (up to 70% of the screen); "full" uses 92%. */
  size?: "auto" | "full";
  /** Keeps the page behind interactive (no backdrop), e.g. the word sheet while reading. */
  modeless?: boolean;
  closeLabel?: string;
  footer?: ReactNode;
}

/**
 * Bottom sheet with a drag handle: swipe down (or tap the backdrop) to close.
 * Respects the safe area so content never sits under the gesture bar.
 */
export default function MobileSheet({ open, title, onClose, children, size = "auto", modeless = false, closeLabel = "Close", footer }: MobileSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; offset: number } | null>(null);

  useEffect(() => {
    if (!open || modeless) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modeless, onClose, open]);

  if (!open) return null;

  const onTouchStart = (event: React.TouchEvent) => {
    drag.current = { startY: event.touches[0]?.clientY ?? 0, offset: 0 };
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (!drag.current || !panelRef.current) return;
    const offset = Math.max(0, (event.touches[0]?.clientY ?? 0) - drag.current.startY);
    drag.current.offset = offset;
    panelRef.current.style.transform = `translateY(${offset}px)`;
  };
  const onTouchEnd = () => {
    const offset = drag.current?.offset ?? 0;
    drag.current = null;
    if (panelRef.current) panelRef.current.style.transform = "";
    if (offset > 90) onClose();
  };

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col justify-end ${modeless ? "pointer-events-none" : ""}`}>
      {!modeless && <button type="button" aria-label={closeLabel} className="absolute inset-0 bg-black/45 mobile-sheet-backdrop" onClick={onClose} />}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={!modeless}
        className={`mobile-sheet pointer-events-auto relative flex flex-col rounded-t-3xl border border-border bg-surface shadow-2xl ${size === "full" ? "h-[92dvh]" : "max-h-[70dvh]"}`}
      >
        <div className="flex-shrink-0 touch-none px-5 pt-2" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border-strong" />
          {title !== undefined && (
            <div className="flex items-center gap-3 pb-2">
              <div className="min-w-0 flex-1 text-base font-semibold text-foreground">{title}</div>
              <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-10 w-10 place-items-center rounded-full text-foreground-muted active:bg-surface-muted">
                <X size={20} />
              </button>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(16px,env(safe-area-inset-bottom))]">{children}</div>
        {footer && <div className="flex-shrink-0 border-t border-border px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  );
}
