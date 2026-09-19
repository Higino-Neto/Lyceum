// Chapter outline: answers an explicit command and reports the tree back as an
// event (request/response over the same versioned message channel).
//
// The PDF.js viewer dispatches "outlineloaded" for *every* document once the
// first page renders; the payload's outlineCount is 0 when the document has no
// bookmarks and > 0 otherwise. The listeners are wired up-front (not inside the
// command handler) so a signal that fires before the host asks is never missed.
// A direct read of pdfDocument.getOutline() is the primary source; when it
// stays empty but the viewer rendered a real outline, the second source — the
// rendered OutlineView widget — recovers the tree.
import { onViewerBooted } from "../../core/lifecycle.mjs";
import { CMD_GET_OUTLINE, EVT_OUTLINE_LOADED, isOutlineNode } from "../../lyceum-core.mjs";

export function installOutlineFeature({ bus, facade }) {
  // < 0: the viewer has not rendered the outline for the current document yet.
  // 0 / > 0: it has, and the outline has 0 / N items.
  let outlineSignalCount = -1;
  let signalTearDown = null;

  function watchOutlineSignal() {
    const app = facade.getApp?.();
    if (signalTearDown || !app?.eventBus) {
      return;
    }
    const eventBus = app.eventBus;
    const onSignal = ({ outlineCount } = {}) => {
      outlineSignalCount = typeof outlineCount === "number" ? outlineCount : 0;
    };
    const onDocumentLoaded = () => {
      outlineSignalCount = -1;
    };
    eventBus.on?.("outlineloaded", onSignal);
    eventBus.on?.("documentloaded", onDocumentLoaded);
    signalTearDown = () => {
      if (typeof eventBus.off === "function") {
        eventBus.off("outlineloaded", onSignal);
        eventBus.off("documentloaded", onDocumentLoaded);
      }
    };
  }

  // Wire the per-document outline state as soon as the viewer boots (its
  // eventBus is created during initialization, so it is available here but not
  // at "webviewerloaded"). Doing this before any document loads closes the race
  // where a fast-rendering document signals "outlineloaded" before the host
  // issues CMD_GET_OUTLINE. The command handler also calls watchOutlineSignal()
  // for safety (it is idempotent).
  onViewerBooted(() => watchOutlineSignal());

  function normalize(outline) {
    return Array.isArray(outline) && outline.every(isOutlineNode) ? outline : [];
  }

  function describe(outline) {
    if (outline === null) return "null";
    if (!Array.isArray(outline)) return typeof outline;
    if (outline.length === 0) return "[]";
    return `${outline.length} nodes (first: "${outline[0]?.title}")`;
  }

  bus.onCommand(CMD_GET_OUTLINE, async data => {
    const requestId = typeof data?.requestId === "string" ? data.requestId : undefined;

    try {
      watchOutlineSignal();

      const app = facade.getApp?.();
      const documentLoaded = Boolean(
        app?.pdfDocument && (facade.readPageCount?.(app) ?? 0) > 0,
      );

      let outline = await facade.getOutline();
      const rawRead = outline;

      // The direct read is asynchronous: the viewer may render its outline
      // (dispatching "outlineloaded") while it is still in flight. Snapshot the
      // signal state *after* the read so a signal seen during it is honored.
      const signalRendered = outlineSignalCount >= 0;
      const signalHasOutline = outlineSignalCount > 0;

      if (outline === null && !documentLoaded) {
        // Request raced the document open: wait until the viewer finishes
        // parsing the outline (its own "outlineloaded" fires with the count).
        outline = (await facade.getOutlineWhenReady?.({
          timeoutMs: 9000,
          signalSeen: signalRendered,
        })) ?? [];
      } else if (Array.isArray(outline) && outline.length === 0) {
        if (!signalRendered || signalHasOutline) {
          // Either the viewer has not rendered the outline yet (page 1 still
          // rendering) or it rendered a real outline that contradicts this
          // empty read. Session state-signal zero short-circuits: an empty read
          // for a fully loaded book without bookmarks is authoritative.
          outline = (await facade.getOutlineWhenReady?.({
            timeoutMs: documentLoaded ? 2500 : 9000,
            signalSeen: signalRendered,
          })) ?? [];
        }
      }

      if (outline.length === 0 && typeof facade.getOutlineFromOutlineView === "function") {
        const rendered = (await facade.getOutlineFromOutlineView(app)) ?? [];
        if (rendered.length > 0) {
          console.warn(
            `[lyceum-outline] direct read was empty; recovered ${rendered.length} nodes from the rendered OutlineView`,
          );
          outline = rendered;
        }
      }

      const finalTree = normalize(outline);
      const pageCount = app?.pdfDocument ? app.pdfDocument.numPages : 0;

      console.warn(
        `[lyceum-outline] raw=${describe(rawRead)} -> final=${describe(finalTree)} ` +
        `(docLoaded=${documentLoaded} pages=${pageCount} signalCount=${outlineSignalCount}) ` +
        `request=${requestId ?? "-"}`,
      );

      bus.emit(EVT_OUTLINE_LOADED, { outline: finalTree, requestId });
    } catch (error) {
      console.error("[lyceum-outline] failed to read the document outline:", error);
      bus.emit(EVT_OUTLINE_LOADED, {
        outline: [],
        requestId,
        error: true,
        message: "Não foi possível ler a estrutura de capítulos deste PDF.",
      });
    }
  });
}