import { bookSections, edgePage, rifflePages, CMD_SET_BOOK_LANDMARKS, isBookLandmark } from "../../lyceum-core.mjs";

// Independent canvases share the open PDF document, never the reader's page or zoom.
export function installBookEdgeFeature({ facade, app, bus }) {
  const edge = document.createElement("button");
  edge.id = "lyceumBookEdge";
  edge.type = "button";
  edge.setAttribute("aria-label", "BookEdge — explorar o livro sem sair da leitura");
  edge.title = "BookEdge · clique em uma região para folhear";
  edge.hidden = true;
  document.body.append(edge);
  const dialog = document.createElement("dialog");
  dialog.id = "lyceumRiffle";
  dialog.setAttribute("aria-labelledby", "riffleTitle");
  dialog.innerHTML = `<header><div><h2 id="riffleTitle">Folhear o livro</h2><p class="riffleContext"></p></div><button type="button" data-action="close">Voltar à leitura · Esc</button></header>
    <div class="riffleBody"><div class="riffleGrid" aria-label="Páginas próximas"></div><section class="riffleLook" aria-label="Close Look"><div class="rifflePreview"></div><div class="riffleActions"><button type="button" data-action="bookmark">Marcar página</button><button type="button" data-action="open">Abrir esta página</button></div></section></div>
    <footer><button type="button" data-action="previous">← Anteriores</button><span class="riffleRange" aria-live="polite"></span><button type="button" data-action="next">Próximas →</button></footer><p class="riffleHelp">Scroll ou setas para folhear · PageUp / PageDown para saltar · selecione uma página para inspecionar</p>`;
  document.body.append(dialog);
  const grid = dialog.querySelector(".riffleGrid");
  const preview = dialog.querySelector(".rifflePreview");
  const button = action => dialog.querySelector(`[data-action="${action}"]`);
  let total = 0, selected = 1, origin = 1, generation = 0, loadGeneration = 0;
  let landmarks = [];
  let sections = [], bookmarks = new Set(), bookmarkKey = "", previousFocus;
  const tasks = new Set();
  const cache = new Map();
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
      node.title = `${mark.kind === "note" ? "Nota" : "Destaque"} · ${mark.page}`;
      edge.append(node);
    }
    for (const page of bookmarks) {
      const mark = document.createElement("span");
      mark.className = "bookEdgeBookmark";
      mark.style.top = `${(page - .5) / total * 100}%`;
      mark.title = `Marca-página · ${page}`;
      edge.append(mark);
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
      copy.setAttribute("aria-label", `Preview da página ${pageNumber}`);
      host.replaceChildren(copy);
    } catch (error) {
      if (token === generation && error?.name !== "RenderingCancelledException") host.textContent = "Não foi possível carregar. Selecione a página para tentar novamente.";
    }
  }
  async function show() {
    stopRendering();
    const token = generation;
    const pages = rifflePages(selected, total, count());
    grid.replaceChildren();
    preview.textContent = "Carregando página…";
    const section = sections.find(item => selected >= item.page && selected <= item.end);
    dialog.querySelector(".riffleContext").textContent = `${section?.title ?? "Livro"} · sua leitura permanece na página ${origin}`;
    dialog.querySelector(".riffleRange").textContent = `${pages[0]}–${pages.at(-1)} de ${total} · seleção ${selected}`;
    button("bookmark").textContent = bookmarks.has(selected) ? "Remover marca-página" : "Marcar página";
    button("bookmark").setAttribute("aria-pressed", String(bookmarks.has(selected)));
    button("previous").disabled = selected === 1;
    button("next").disabled = selected === total;
    const hosts = pages.map(page => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "riffleTile";
      tile.setAttribute("aria-label", `Inspecionar página ${page}`);
      tile.setAttribute("aria-pressed", String(page === selected));
      const sheet = document.createElement("span");
      sheet.className = "riffleSheet";
      sheet.textContent = "…";
      const label = document.createElement("span");
      label.textContent = `${page}${bookmarks.has(page) ? " · marcada" : ""}`;
      tile.append(sheet, label);
      tile.onclick = () => { selected = page; void show(); grid.querySelector('[aria-pressed="true"]')?.focus(); };
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
    catch { dialog.querySelector(".riffleHelp").textContent = "Marca disponível nesta sessão; não foi possível salvá-la neste dispositivo."; }
    paintEdge();
    void show();
  };
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("keydown", event => {
    // Keep PDF.js global shortcuts from moving/zooming the underlying reader.
    event.stopPropagation();
    const deltas = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1, PageUp: -count(), PageDown: count(), Home: -total, End: total };
    if (event.key in deltas) { event.preventDefault(); event.stopPropagation(); move(deltas[event.key]); }
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
  app.eventBus.on("pagesinit", load);
  app.eventBus.on("pagechanging", paintEdge);
  if (app.pdfDocument) void load();
  return { open, close };
}
