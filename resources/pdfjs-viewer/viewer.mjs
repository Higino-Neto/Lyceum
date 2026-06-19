import * as pdfjsLib from "./build/pdf.mjs";
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from "./web/pdf_viewer.mjs";

const params = new URLSearchParams(window.location.search);
const fileUrl = params.get("file");
const title = params.get("title") || "PDF";

const container = document.getElementById("viewerContainer");
const viewerElement = document.getElementById("viewer");
const loadingElement = document.getElementById("loading");
const errorElement = document.getElementById("error");
const previousButton = document.getElementById("previous");
const nextButton = document.getElementById("next");
const pageNumberInput = document.getElementById("pageNumber");
const pageCountElement = document.getElementById("pageCount");
const zoomOutButton = document.getElementById("zoomOut");
const zoomInButton = document.getElementById("zoomIn");
const scaleSelect = document.getElementById("scaleSelect");
const findInput = document.getElementById("findInput");

document.title = `${title} - PDF.js`;

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./build/pdf.worker.mjs",
  import.meta.url,
).toString();

let pdfDocument = null;
let initialized = false;
let resolveInitialized;
const initializedPromise = new Promise((resolve) => {
  resolveInitialized = resolve;
});

const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const findController = new PDFFindController({ eventBus, linkService });
const pdfViewer = new PDFViewer({
  container,
  viewer: viewerElement,
  eventBus,
  linkService,
  findController,
  imageResourcesPath: new URL("./web/images/", import.meta.url).toString(),
  removePageBorders: false,
  enablePermissions: true,
  enableHWA: true,
});

linkService.setViewer(pdfViewer);

function getPageCount() {
  return Number(pdfDocument?.numPages ?? pdfViewer.pagesCount ?? 0) || 0;
}

function clampPage(page) {
  const pages = Math.max(1, getPageCount() || 1);
  return Math.min(pages, Math.max(1, Math.round(Number(page) || 1)));
}

function syncControls() {
  const pages = getPageCount();
  const currentPage = clampPage(pdfViewer.currentPageNumber || 1);
  pageNumberInput.value = String(currentPage);
  pageNumberInput.max = String(Math.max(1, pages || 1));
  pageCountElement.textContent = `/ ${pages || 0}`;
  previousButton.disabled = currentPage <= 1;
  nextButton.disabled = pages > 0 && currentPage >= pages;

  const scale = Number(pdfViewer.currentScale || 0);
  const selectedNumericOption = [...scaleSelect.options].find(
    (option) => Math.abs(Number(option.value) - scale) < 0.01,
  );

  if (selectedNumericOption) {
    scaleSelect.value = selectedNumericOption.value;
  }
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error || "Erro desconhecido");
  loadingElement.hidden = true;
  errorElement.hidden = false;
  errorElement.textContent = `Nao foi possivel abrir este PDF. ${message}`;
  console.error("[PDF.js Viewer]", error);
}

function finishInitialization() {
  if (initialized) {
    return;
  }

  initialized = true;
  loadingElement.hidden = true;
  syncControls();
  resolveInitialized(true);
  container.focus();
}

function dispatchFind(query, findPrevious = false) {
  eventBus.dispatch("find", {
    source: window,
    type: "",
    query,
    caseSensitive: false,
    entireWord: false,
    highlightAll: true,
    findPrevious,
    matchDiacritics: true,
  });
}

window.PDFViewerApplication = {
  eventBus,
  findController,
  initializedPromise,
  linkService,
  pdfViewer,
  get initialized() {
    return initialized;
  },
  get page() {
    return pdfViewer.currentPageNumber || 1;
  },
  set page(value) {
    pdfViewer.currentPageNumber = clampPage(value);
  },
  get pagesCount() {
    return getPageCount();
  },
  get pdfDocument() {
    return pdfDocument;
  },
};

previousButton.addEventListener("click", () => {
  pdfViewer.previousPage();
  syncControls();
});

nextButton.addEventListener("click", () => {
  pdfViewer.nextPage();
  syncControls();
});

pageNumberInput.addEventListener("change", () => {
  pdfViewer.currentPageNumber = clampPage(pageNumberInput.value);
  syncControls();
});

zoomOutButton.addEventListener("click", () => {
  pdfViewer.decreaseScale();
  syncControls();
});

zoomInButton.addEventListener("click", () => {
  pdfViewer.increaseScale();
  syncControls();
});

scaleSelect.addEventListener("change", () => {
  const value = scaleSelect.value;
  pdfViewer.currentScaleValue = value;
  syncControls();
});

findInput.addEventListener("input", () => {
  dispatchFind(findInput.value);
});

findInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  dispatchFind(findInput.value, event.shiftKey);
});

container.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) {
    return;
  }

  if (event.key === "PageDown" || event.key === "ArrowRight") {
    event.preventDefault();
    pdfViewer.nextPage();
    syncControls();
  } else if (event.key === "PageUp" || event.key === "ArrowLeft") {
    event.preventDefault();
    pdfViewer.previousPage();
    syncControls();
  }
});

eventBus.on("pagesinit", () => {
  if (!pdfViewer.currentScaleValue || pdfViewer.currentScaleValue === "auto") {
    pdfViewer.currentScaleValue = "page-width";
  }
  finishInitialization();
});

eventBus.on("pagechanging", syncControls);
eventBus.on("scalechanging", syncControls);
eventBus.on("pagesloaded", syncControls);

async function openDocument() {
  if (!fileUrl) {
    throw new Error("URL do PDF ausente");
  }

  const loadingTask = pdfjsLib.getDocument({
    url: fileUrl,
    cMapPacked: true,
    cMapUrl: new URL("./cmaps/", import.meta.url).toString(),
    standardFontDataUrl: new URL("./standard_fonts/", import.meta.url).toString(),
    useSystemFonts: true,
    enableXfa: true,
  });

  pdfDocument = await loadingTask.promise;
  pdfViewer.setDocument(pdfDocument);
  linkService.setDocument(pdfDocument, null);

  await pdfViewer.pagesPromise.catch(() => undefined);
  finishInitialization();
}

openDocument().catch((error) => {
  showError(error);
  resolveInitialized(false);
});
