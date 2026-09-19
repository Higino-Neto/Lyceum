// Reader chrome: book title, chapter sidebar button, Key Concepts button and
// the native PDF.js sidebar neutralization (Lyceum owns the chapter panel).
import { EVT_READY, EVT_TOGGLE_ANNOTATIONS, EVT_TOGGLE_CHAPTERS, CMD_SET_ANNOTATIONS_STATE, CMD_SET_CHAPTERS_STATE } from "../../lyceum-core.mjs";

// Mirrors the flag used by the CSS to show the annotation toggle button.
export const ANNOTATION_BUTTON_ID = "lyceumAnnotationToggleButton";

// PDF.js SidebarView.NONE (module-scoped in the viewer; never imported here).
const SIDEBAR_VIEW_NONE = 0;

export function installToolbarFeature({ bus, facade, title = "" }) {
  let chapterInstalled = false;
  let annotationInstalled = false;

  function closeNativeSidebar(app) {
    const sidebar = app?.pdfSidebar;
    if (sidebar?.isOpen && typeof sidebar.close === "function") {
      sidebar.close();
    }

    document.getElementById("outerContainer")?.classList.remove("sidebarMoving", "sidebarOpen");
  }

  // Lyceum owns the chapter panel, so the native PDF.js sidebar must never
  // open: PDF.js auto-opens it through setInitialView/preferences and through
  // page-mode hashes (switchView with forceOpen), so both are neutralized.
  function neutralizeNativeSidebar(app) {
    const sidebar = app?.pdfSidebar;
    if (!sidebar || app.__lyceumSidebarNeutralized) {
      return;
    }
    app.__lyceumSidebarNeutralized = true;

    const closeAndStayClosed = () => {
      closeNativeSidebar(app);
      if (typeof sidebar.switchView === "function" && sidebar.active !== SIDEBAR_VIEW_NONE) {
        try {
          sidebar.switchView(SIDEBAR_VIEW_NONE);
        } catch {
          // Best-effort: the overlay must never break during viewer lifecycle.
        }
      }
    };

    const originalSwitchView = sidebar.switchView.bind(sidebar);
    sidebar.switchView = function (view, forceOpen = false, ...rest) {
      if (forceOpen === true) {
        return originalSwitchView(SIDEBAR_VIEW_NONE);
      }
      return originalSwitchView(view, false, ...rest);
    };

    if (typeof sidebar.setInitialView === "function") {
      const originalSetInitialView = sidebar.setInitialView.bind(sidebar);
      sidebar.setInitialView = function (view = SIDEBAR_VIEW_NONE) {
        if (view === SIDEBAR_VIEW_NONE) {
          return originalSetInitialView(view);
        }
        closeAndStayClosed();
        return undefined;
      };
    }

    closeAndStayClosed();
    app.eventBus?.on?.("documentloaded", closeAndStayClosed);
    app.eventBus?.on?.("pagesinit", closeAndStayClosed);
  }

  function updateLyceumChapterButton(open) {
    const button = document.getElementById("sidebarToggleButton");
    if (!button) {
      return;
    }

    button.classList.add("lyceumChapterToggle");
    button.classList.toggle("toggled", !!open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-pressed", open ? "true" : "false");
    button.setAttribute("title", "Mostrar/ocultar painel de capitulos");
    button.removeAttribute("aria-haspopup");
    button.removeAttribute("data-l10n-id");

    const label = button.querySelector("span");
    if (label) {
      label.textContent = "Capitulos";
      label.removeAttribute("data-l10n-id");
    }
  }

  function updateLyceumAnnotationButton(open, count = 0) {
    const button = document.getElementById(ANNOTATION_BUTTON_ID);
    if (!button) {
      return;
    }

    button.classList.toggle("toggled", !!open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-pressed", open ? "true" : "false");

    const badge = button.querySelector(".lyceumAnnotationBadge");
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.round(Number(count))) : 0;
    if (safeCount > 0) {
      badge.textContent = String(Math.min(99, safeCount));
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function sendChapterToggleRequest() {
    try {
      bus.emit(EVT_TOGGLE_CHAPTERS);
    } catch {
      // Cross-frame messaging is best-effort; the PDF reader remains usable.
    }
  }

  function sendAnnotationToggleRequest() {
    try {
      bus.emit(EVT_TOGGLE_ANNOTATIONS);
    } catch {
      // Cross-frame messaging is best-effort; the PDF reader remains usable.
    }
  }

  function installChapterToggleBridge() {
    const button = document.getElementById("sidebarToggleButton");
    if (!button || button.__lyceumChapterToggleInstalled) {
      return;
    }

    button.__lyceumChapterToggleInstalled = true;
    updateLyceumChapterButton(false);

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeNativeSidebar(facade.getApp());
        sendChapterToggleRequest();
      },
      true,
    );

    bus.onCommand(CMD_SET_CHAPTERS_STATE, data => {
      closeNativeSidebar(facade.getApp());
      updateLyceumChapterButton(!!data.open);
    });

    try {
      bus.emit(EVT_READY);
    } catch {
      // Ignore: Lyceum also syncs state from the iframe load handler.
    }

    chapterInstalled = true;
  }

  function createLyceumAnnotationButton() {
    const existing = document.getElementById(ANNOTATION_BUTTON_ID);
    if (existing) {
      return existing;
    }

    const referenceButton = document.getElementById("sidebarToggleButton");
    const toolbarGroup = referenceButton?.parentElement ?? document.getElementById("toolbarViewerLeft");
    if (!toolbarGroup) {
      return null;
    }

    const button = document.createElement("button");
    button.id = ANNOTATION_BUTTON_ID;
    button.type = "button";
    button.className = "toolbarButton lyceumAnnotationToggle";
    button.title = "Key Concepts";
    button.setAttribute("aria-label", "Key Concepts");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-pressed", "false");

    const label = document.createElement("span");
    label.textContent = "Key Concepts";
    button.append(label);

    const badge = document.createElement("span");
    badge.className = "lyceumAnnotationBadge";
    badge.hidden = true;
    button.append(badge);

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      sendAnnotationToggleRequest();
    }, true);

    referenceButton?.after(button);
    if (!referenceButton) {
      toolbarGroup.prepend(button);
    }

    return button;
  }

  function installAnnotationToggleBridge() {
    const button = createLyceumAnnotationButton();
    if (!button || button.__lyceumAnnotationToggleInstalled) {
      return;
    }

    button.__lyceumAnnotationToggleInstalled = true;
    updateLyceumAnnotationButton(false, 0);

    bus.onCommand(CMD_SET_ANNOTATIONS_STATE, data => {
      updateLyceumAnnotationButton(!!data.open, data.count);
    });

    annotationInstalled = true;
  }

  function wrapNativeSidebarToggle() {
    const app = facade.getApp();
    const sidebar = app?.pdfSidebar;
    if (!sidebar || typeof sidebar.toggle !== "function" || sidebar.__lyceumToggleWrapped) {
      return;
    }

    sidebar.__lyceumToggleWrapped = true;
    sidebar.toggle = function () {
      closeNativeSidebar(app);
      sendChapterToggleRequest();
    };
  }

  installChapterToggleBridge();
  installAnnotationToggleBridge();
  facade.applyLyceumTitle(title);

  const app = facade.getApp();
  if (app) {
    app.eventBus?.on?.("documentloaded", () => facade.applyLyceumTitle(title));
  }

  return {
    install() {
      installChapterToggleBridge();
      installAnnotationToggleBridge();
      facade.applyLyceumTitle(title);
    },
    onAppReady(readyApp) {
      installChapterToggleBridge();
      installAnnotationToggleBridge();
      wrapNativeSidebarToggle();
      neutralizeNativeSidebar(readyApp);
      closeNativeSidebar(readyApp);
      readyApp.eventBus?.on?.("documentloaded", () => facade.applyLyceumTitle(title));
    },
    get chapterInstalled() {
      return chapterInstalled;
    },
    get annotationInstalled() {
      return annotationInstalled;
    },
  };
}