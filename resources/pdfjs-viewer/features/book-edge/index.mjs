import {
  bookSections, edgePage, rifflePages, formatPageRanges, pageRuns, isPagePicksCommand,
  CMD_SET_BOOK_LANDMARKS, CMD_SET_STRINGS, CMD_SET_PAGE_PICKS, CMD_SET_PAGE_PICK_STATE,
  EVT_EXPORT_PAGES, EVT_REQUEST_EXERCISE_PAGES, isBookLandmark,
} from "../../lyceum-core.mjs";

const DEFAULT_STRINGS = {
  edgeAriaLabel: "BookEdge — browse the book without leaving reading",
  edgeTitle: "BookEdge · click a region to riffle",
  dialogTitle: "Riffle through the book",
  closeLabel: "Back to reading · Esc",
  gridAriaLabel: "Nearby pages",
  closeLookAriaLabel: "Close look",
  bookmarkAdd: "Add bookmark",
  bookmarkRemove: "Remove bookmark",
  openPage: "Open this page",
  previous: "← Previous",
  next: "Next →",
  help: "Scroll or arrows to riffle · PageUp / PageDown to jump · select a page to inspect",
  contextFallback: "Book",
  contextPage: "your reading stays on page {{page}}",
  range: "{{from}}–{{to}} of {{total}} · selection {{selected}}",
  selection: "selection",
  inspectPage: "Inspect page {{page}}",
  marked: " · marked",
  loading: "Loading page…",
  loadError: "Could not load. Select the page to try again.",
  previewPage: "Preview of page {{page}}",
  bookmarkSavedSession: "Bookmark available this session; could not save on this device.",
  landmarkNote: "Note · {{page}}",
  landmarkHighlight: "Highlight · {{page}}",
  bookmarkTitle: "Bookmark · {{page}}",
  pickHint: "Right-click a page to pick it for export · right-drag to pick several · Ctrl+click toggles · Shift+click picks a range · Space picks the inspected page",
  pickSummary: "{{count}} picked · {{ranges}}",
  pickClear: "Clear",
  pickExport: "Export pages",
  pickExercises: "Pick exercises",
  pickAdd: "Pick for export",
  pickRemove: "Unpick",
  pickBusyExport: "Exporting…",
  pickBusyExercises: "Finding exercises…",
  pickedLabel: " · picked",
};

function formatString(template, values = {}) {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}

// Independent canvases share the open PDF document, never the reader's page or zoom.
export function installBookEdgeFeature({ facade, app, bus }) {
  let strings = { ...DEFAULT_STRINGS };

  const edge = document.createElement("button");
  edge.id = "lyceumBookEdge";
  edge.type = "button";
  edge.setAttribute("aria-label", strings.edgeAriaLabel);
  edge.title = strings.edgeTitle;
  edge.hidden = true;
  document.body.append(edge);
  const dialog = document.createElement("dialog");
  dialog.id = "lyceumRiffle";
  dialog.setAttribute("aria-labelledby", "riffleTitle");
  dialog.innerHTML = `<header><div><h2 id="riffleTitle">${strings.dialogTitle}</h2><p class="riffleContext"></p></div><button type="button" data-action="close">${strings.closeLabel}</button></header>
    <div class="riffleBody"><div class="riffleGrid" aria-label="${strings.gridAriaLabel}"></div><section class="riffleLook" aria-label="${strings.closeLookAriaLabel}"><div class="rifflePreview"></div><div class="riffleActions"><button type="button" data-action="pick" aria-pressed="false">${strings.pickAdd}</button><button type="button" data-action="bookmark">${strings.bookmarkAdd}</button><button type="button" data-action="open">${strings.openPage}</button></div></section></div>
    <div class="rifflePickBar" data-empty="true"><p class="rifflePickSummary" aria-live="polite"></p><div class="rifflePickActions"><button type="button" data-action="pick-exercises" hidden>${strings.pickExercises}</button><button type="button" data-action="pick-clear">${strings.pickClear}</button><button type="button" data-action="pick-export">${strings.pickExport}</button></div></div>
    <footer><button type="button" data-action="previous">${strings.previous}</button><span class="riffleRange" aria-live="polite"></span><button type="button" data-action="next">${strings.next}</button></footer><p class="riffleHelp">${strings.help}</p>`;

  function applyStrings(next = {}) {
    strings = { ...DEFAULT_STRINGS, ...(next.bookEdge || next) };
    edge.setAttribute("aria-label", strings.edgeAriaLabel);
    edge.title = strings.edgeTitle;
    const title = dialog.querySelector("#riffleTitle");
    if (title) title.textContent = strings.dialogTitle;
    const close = dialog.querySelector('[data-action="close"]');
    if (close) close.textContent = strings.closeLabel;
    const grid = dialog.querySelector(".riffleGrid");
    if (grid) grid.setAttribute("aria-label", strings.gridAriaLabel);
    const look = dialog.querySelector(".riffleLook");
    if (look) look.setAttribute("aria-label", strings.closeLookAriaLabel);
    const bookmark = button("bookmark");
    if (bookmark && bookmarks) {
      bookmark.textContent = bookmarks.has(selected) ? strings.bookmarkRemove : strings.bookmarkAdd;
    } else if (bookmark) {
      bookmark.textContent = strings.bookmarkAdd;
    }
    const open = button("open");
    if (open) open.textContent = strings.openPage;
    const prev = button("previous");
    if (prev) prev.textContent = strings.previous;
    const nextBtn = button("next");
    if (nextBtn) nextBtn.textContent = strings.next;
    const help = dialog.querySelector(".riffleHelp");
    if (help) help.textContent = strings.help;
    if (button("pick-clear")) button("pick-clear").textContent = strings.pickClear;
    refreshPicks();
  }
  document.body.append(dialog);
  const grid = dialog.querySelector(".riffleGrid");
  const preview = dialog.querySelector(".rifflePreview");
  const button = action => dialog.querySelector(`[data-action="${action}"]`);
  let total = 0, selected = 1, origin = 1, generation = 0, loadGeneration = 0;
  let landmarks = [];
  let sections = [], bookmarks = new Set(), bookmarkKey = "", previousFocus;
  const tasks = new Set();
  const cache = new Map();
  // Pages picked for export (one-based). Survive closing the dialog and are kept per book on this device.
  let picked = new Set(), pickKey = "", anchor = null, paint = null;
  let pickState = { exportAvailable: false, exercisesAvailable: false, busy: null };
  const count = () => window.innerWidth < 640 ? 6 : window.innerWidth < 1100 ? 8 : 12;
  const clamp = page => Math.max(1, Math.min(total, page));
  function stopRendering() {
    generation++;
    for (const task of tasks) task.cancel();
    tasks.clear();
  }
  function paintEdge() {
    if (!total) return;
    edge.hidden = false;
    edge.replaceChildren();
    const current = facade.readCurrentPage(app);
    edge.style.setProperty("--opened", `${((current - .5) / total) * 100}%`);
    for (const section of sections) {
      const block = document.createElement("span");
      block.className = "bookEdgeSection";
      block.style.top = `${(section.page - 1) / total * 100}%`;
      block.style.height = `${(section.end - section.page + 1) / total * 100}%`;
      block.title = section.title;
      edge.append(block);
    }
    const buckets = new Set();
    for (const mark of landmarks) {
      if (mark.page > total) continue;
      const position = (mark.page - .5) / total * 100;
      const key = `${mark.kind}:${Math.round(position * 2)}`;
      if (buckets.has(key)) continue;
      buckets.add(key);
      const node = document.createElement("span");
      node.className = `bookEdgeLandmark ${mark.kind}`;
      node.style.top = `${position}%`;
      node.title = mark.kind === "note" ? formatString(strings.landmarkNote, { page: mark.page }) : formatString(strings.landmarkHighlight, { page: mark.page });
      edge.append(node);
    }
    for (const page of bookmarks) {
      const mark = document.createElement("span");
      mark.className = "bookEdgeBookmark";
      mark.style.top = `${(page - .5) / total * 100}%`;
      mark.title = formatString(strings.bookmarkTitle, { page });
      edge.append(mark);
    }
    for (const run of pageRuns(picked)) {
      if (run.from > total) continue;
      const block = document.createElement("span");
      block.className = "bookEdgePicked";
      block.style.top = `${(run.from - 1) / total * 100}%`;
      block.style.height = `max(2px, ${(run.to - run.from + 1) / total * 100}%)`;
      block.title = formatPageRanges(range(run.from, run.to));
      edge.append(block);
    }
    const notch = document.createElement("span");
    notch.className = "bookEdgeNotch";
    edge.append(notch);
  }
  async function load() {
    const revision = ++loadGeneration;
    close();
    cache.clear();
    total = facade.readPageCount(app);
    if (!total) { edge.hidden = true; return; }
    bookmarkKey = `lyceum:book-edge:v1:${app.pdfDocument.fingerprints?.[0] ?? new URL(location.href).searchParams.get("file")}`;
    try {
      const saved = JSON.parse(localStorage.getItem(bookmarkKey) ?? "[]");
      bookmarks = new Set(Array.isArray(saved) ? saved.filter(page => Number.isInteger(page) && page >= 1 && page <= total) : []);
    } catch { bookmarks = new Set(); }
    pickKey = bookmarkKey.replace("lyceum:book-edge:v1:", "lyceum:book-edge:picks:v1:");
    try {
      const saved = JSON.parse(localStorage.getItem(pickKey) ?? "[]");
      picked = new Set(Array.isArray(saved) ? saved.filter(page => Number.isInteger(page) && page >= 1 && page <= total) : []);
    } catch { picked = new Set(); }
    anchor = null;
    refreshPicks();
    sections = bookSections([], total);
    paintEdge();
    try {
      const outline = await facade.getOutline();
      if (revision !== loadGeneration) return;
      sections = bookSections(outline ?? [], total);
      paintEdge();
    } catch { /* An unstructured book still has a spatial edge. */ }
  }
  async function renderPage(pageNumber, host, width, token) {
    const key = `${pageNumber}:${width}`;
    try {
      let canvas = cache.get(key);
      if (!canvas) {
        const pdfPage = await app.pdfDocument.getPage(pageNumber);
        if (token !== generation) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(width / natural.width, (width * 1.5) / natural.height);
        const viewport = pdfPage.getViewport({ scale });
        canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const task = pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport });
        tasks.add(task);
        try { await task.promise; } finally { tasks.delete(task); }
        if (token !== generation) return;
        cache.set(key, canvas);
        // Bounded bitmap cache; no whole-book rendering or duplicate PDF loading.
        while (cache.size > 32) cache.delete(cache.keys().next().value);
      }
      if (token !== generation) return;
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext("2d").drawImage(canvas, 0, 0);
      copy.setAttribute("aria-label", formatString(strings.previewPage, { page: pageNumber }));
      host.replaceChildren(copy);
    } catch (error) {
      if (token === generation && error?.name !== "RenderingCancelledException") host.textContent = strings.loadError;
    }
  }
  async function show() {
    stopRendering();
    const token = generation;
    const pages = rifflePages(selected, total, count());
    grid.replaceChildren();
    preview.textContent = strings.loading;
    const section = sections.find(item => selected >= item.page && selected <= item.end);
    dialog.querySelector(".riffleContext").textContent = `${section?.title ?? strings.contextFallback} · ${formatString(strings.contextPage, { page: origin })}`;
    dialog.querySelector(".riffleRange").textContent = formatString(strings.range, { from: pages[0], to: pages.at(-1), total, selected });
    button("bookmark").textContent = bookmarks.has(selected) ? strings.bookmarkRemove : strings.bookmarkAdd;
    button("bookmark").setAttribute("aria-pressed", String(bookmarks.has(selected)));
    refreshPickButton();
    button("previous").disabled = selected === 1;
    button("next").disabled = selected === total;
    const hosts = pages.map(page => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "riffleTile";
      tile.setAttribute("aria-label", formatString(strings.inspectPage, { page }));
      tile.setAttribute("aria-pressed", String(page === selected));
      tile.dataset.page = String(page);
      tile.classList.toggle("isPicked", picked.has(page));
      const sheet = document.createElement("span");
      sheet.className = "riffleSheet";
      sheet.textContent = "…";
      const label = document.createElement("span");
      label.className = "riffleTileLabel";
      label.textContent = tileLabel(page);
      const check = document.createElement("span");
      check.className = "rifflePickCheck";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      tile.append(sheet, label, check);
      tile.onclick = event => {
        if (event.ctrlKey || event.metaKey) { togglePick(page); anchor = page; return; }
        if (event.shiftKey) { pickRange(anchor ?? selected, page, true); anchor = page; return; }
        selected = page; void show(); grid.querySelector('[aria-pressed="true"]')?.focus();
      };
      grid.append(tile);
      return { page, sheet };
    });
    // Two workers at most, including Close Look, even for huge documents.
    const jobs = [{ page: selected, sheet: preview, width: 900 }, ...hosts.map(item => ({ ...item, width: 260 }))];
    const worker = async () => {
      while (jobs.length && token === generation) {
        const item = jobs.shift();
        await renderPage(item.page, item.sheet, item.width, token);
      }
    };
    await Promise.all([worker(), worker()]);
  }
  function range(from, to) {
    const pages = [];
    for (let page = Math.min(from, to); page <= Math.max(from, to); page += 1) pages.push(page);
    return pages;
  }
  function tileLabel(page) {
    return `${page}${bookmarks.has(page) ? strings.marked : ""}${picked.has(page) ? strings.pickedLabel : ""}`;
  }
  function savePicks() {
    if (!pickKey) return;
    try { localStorage.setItem(pickKey, JSON.stringify([...picked].sort((a, b) => a - b))); } catch { /* Session-only picks still work. */ }
  }
  function refreshPickButton() {
    const pick = button("pick");
    if (!pick) return;
    pick.textContent = picked.has(selected) ? strings.pickRemove : strings.pickAdd;
    pick.setAttribute("aria-pressed", String(picked.has(selected)));
  }
  // Updates marks in place: no re-render, so picking stays instant while riffling.
  function refreshPicks() {
    for (const tile of grid?.querySelectorAll(".riffleTile") ?? []) {
      const page = Number(tile.dataset.page);
      tile.classList.toggle("isPicked", picked.has(page));
      const label = tile.querySelector(".riffleTileLabel");
      if (label) label.textContent = tileLabel(page);
    }
    refreshPickButton();
    const bar = dialog.querySelector(".rifflePickBar");
    const summary = dialog.querySelector(".rifflePickSummary");
    if (!bar || !summary) return;
    const count = picked.size;
    bar.dataset.empty = String(count === 0);
    summary.textContent = pickState.busy === "export" ? strings.pickBusyExport
      : pickState.busy === "exercises" ? strings.pickBusyExercises
        : count ? formatString(strings.pickSummary, { count, ranges: formatPageRanges(picked) }) : strings.pickHint;
    summary.title = count ? formatPageRanges(picked) : "";
    const exportButton = button("pick-export");
    exportButton.hidden = !pickState.exportAvailable;
    exportButton.disabled = !count || Boolean(pickState.busy);
    exportButton.textContent = count ? `${strings.pickExport} (${count})` : strings.pickExport;
    button("pick-clear").disabled = !count || Boolean(pickState.busy);
    const exercises = button("pick-exercises");
    exercises.hidden = !pickState.exercisesAvailable;
    exercises.disabled = Boolean(pickState.busy);
    exercises.textContent = strings.pickExercises;
  }
  function setPicks(pages, mode) {
    if (mode === "replace") picked = new Set();
    for (const page of pages) {
      if (page < 1 || page > total) continue;
      if (mode === "remove") picked.delete(page); else picked.add(page);
    }
    savePicks();
    refreshPicks();
    paintEdge();
  }
  function togglePick(page) {
    setPicks([page], picked.has(page) ? "remove" : "add");
  }
  function pickRange(from, to, add) {
    setPicks(range(clamp(from), clamp(to)), add ? "add" : "remove");
  }

  function open(page) {
    if (!total) return;
    origin = facade.readCurrentPage(app);
    selected = clamp(page);
    previousFocus = document.activeElement;
    dialog.showModal();
    edge.classList.add("isExpanded");
    void show();
    button("close").focus();
  }
  function close() {
    stopRendering();
    if (dialog.open) { dialog.close(); previousFocus?.focus?.(); }
    edge.classList.remove("isExpanded");
  }
  function move(delta) {
    const next = clamp(selected + delta);
    if (next === selected) return;
    const gridFocused = grid.contains(document.activeElement);
    selected = next;
    void show();
    if (gridFocused) grid.querySelector('[aria-pressed="true"]')?.focus();
  }
  edge.onclick = event => {
    const bounds = edge.getBoundingClientRect();
    open(event.detail === 0 ? facade.readCurrentPage(app) : edgePage((event.clientY - bounds.top) / bounds.height, total));
  };
  button("close").onclick = close;
  button("open").onclick = () => { const page = selected; close(); void facade.applyPageAndScroll(app, { page }); };
  button("previous").onclick = () => move(-count());
  button("next").onclick = () => move(count());
  button("bookmark").onclick = () => {
    if (bookmarks.has(selected)) bookmarks.delete(selected); else bookmarks.add(selected);
    try { localStorage.setItem(bookmarkKey, JSON.stringify([...bookmarks])); }
    catch { dialog.querySelector(".riffleHelp").textContent = strings.bookmarkSavedSession; }
    paintEdge();
    void show();
  };
  button("pick").onclick = () => { togglePick(selected); anchor = selected; };
  button("pick-clear").onclick = () => { setPicks([], "replace"); anchor = null; };
  button("pick-export").onclick = () => {
    if (picked.size) bus?.emit(EVT_EXPORT_PAGES, { pages: [...picked].sort((a, b) => a - b) });
  };
  button("pick-exercises").onclick = () => bus?.emit(EVT_REQUEST_EXERCISE_PAGES, {});
  // Right button: click toggles, drag paints the same state over every tile it crosses.
  grid.addEventListener("contextmenu", event => event.preventDefault());
  preview.addEventListener("contextmenu", event => { event.preventDefault(); togglePick(selected); anchor = selected; });
  grid.addEventListener("pointerdown", event => {
    if (event.button !== 2) return;
    const tile = event.target.closest?.(".riffleTile");
    if (!tile) return;
    event.preventDefault();
    const page = Number(tile.dataset.page);
    if (event.shiftKey) { pickRange(anchor ?? selected, page, true); anchor = page; return; }
    paint = picked.has(page) ? "remove" : "add";
    setPicks([page], paint);
    anchor = page;
  });
  grid.addEventListener("pointerover", event => {
    if (!paint || !(event.buttons & 2)) return;
    const tile = event.target.closest?.(".riffleTile");
    if (tile) setPicks([Number(tile.dataset.page)], paint);
  });
  window.addEventListener("pointerup", () => { paint = null; });
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("keydown", event => {
    // Keep PDF.js global shortcuts from moving/zooming the underlying reader.
    event.stopPropagation();
    const onActionButton = event.target instanceof HTMLButtonElement && !event.target.classList.contains("riffleTile");
    if ((event.key === " " && !onActionButton) || (event.key.toLowerCase() === "x" && !event.ctrlKey && !event.metaKey)) {
      event.preventDefault();
      togglePick(selected);
      anchor = selected;
      return;
    }
    const deltas = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1, PageUp: -count(), PageDown: count(), Home: -total, End: total };
    if (event.key in deltas) {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey && ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) {
        // Shift+arrows pick as they move, like extending a selection in a file manager.
        const from = selected;
        move(deltas[event.key]);
        pickRange(from, selected, true);
        anchor = selected;
        return;
      }
      move(deltas[event.key]);
    }
  });
  dialog.addEventListener("wheel", event => {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  }, { passive: false });
  let lastWheel = 0;
  grid.addEventListener("wheel", event => {
    event.preventDefault();
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 2 || Date.now() - lastWheel < 120) return;
    lastWheel = Date.now();
    move(Math.sign(delta) * Math.max(1, Math.floor(count() / 2)));
  }, { passive: false });
  let touchX = null;
  grid.addEventListener("pointerdown", event => { if (event.pointerType === "touch") touchX = event.clientX; });
  grid.addEventListener("pointerup", event => {
    if (touchX !== null && Math.abs(event.clientX - touchX) > 50) move(event.clientX < touchX ? count() : -count());
    touchX = null;
  });
  bus?.onCommand(CMD_SET_BOOK_LANDMARKS, data => {
    landmarks = Array.isArray(data.landmarks) ? data.landmarks.filter(isBookLandmark) : [];
    paintEdge();
  });
  bus?.onCommand(CMD_SET_STRINGS, data => {
    applyStrings(data?.strings || data);
    paintEdge();
    // Only re-render previews when the dialog is visible.
    if (dialog.open) void show();
  });
  bus?.onCommand(CMD_SET_PAGE_PICKS, data => {
    if (!isPagePicksCommand(data)) return;
    setPicks(data.pages, data.mode);
    // Jump the riffle to the first newly picked page so the result is visible.
    if (dialog.open && data.mode !== "remove" && data.pages.length) { selected = clamp(Math.min(...data.pages)); void show(); }
  });
  bus?.onCommand(CMD_SET_PAGE_PICK_STATE, data => {
    pickState = {
      exportAvailable: data?.exportAvailable === true,
      exercisesAvailable: data?.exercisesAvailable === true,
      busy: data?.busy === "export" || data?.busy === "exercises" ? data.busy : null,
    };
    refreshPicks();
  });
  app.eventBus.on("pagesinit", load);
  app.eventBus.on("pagechanging", paintEdge);
  if (app.pdfDocument) void load();
  return { open, close };
}
