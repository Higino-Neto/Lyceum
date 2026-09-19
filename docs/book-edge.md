# BookEdge / Riffle MVP

The desktop PDF reader has a spatial edge on the right. Chapter boundaries come
from the PDF outline; lengths match page spans. A book without an outline has a
single continuous block. The notch indicates the current page, with different
paper tones before and after it (position, not a claim that every earlier page
has been read). Notes are dots, concept highlights are fine lines, and local
bookmarks are tabs. Nearby notes/highlights are coalesced to limit clutter.

Click any region to explore it. Keyboard activation starts at the current page.
Riffle shows 6, 8 or 12 nearby pages, with a larger Close Look preview. Use the
wheel/trackpad over the thumbnails, arrows, PageUp/PageDown, Home/End, touch
swipes or previous/next buttons. Select a thumbnail to inspect it; only **Abrir
esta página** changes the reader. Escape and **Voltar à leitura** cancel without
changing the original page, scroll offset or zoom. The modal keeps focus inside
and restores focus when closed.

The existing PDF document renders independent canvases. At most two jobs run
per view, superseded render tasks are cancelled, and a 32-entry bitmap cache
bounds retained previews. No second document or full-book rasterization is used.
Bookmarks are stored locally by PDF fingerprint with a versioned key; they are
not part of cloud sync or backup. Existing concepts supply note/highlight marks
through an additive, validated bridge command. Images and tables are visible in
the previews but are not automatically classified as landmarks in this MVP.
EPUB and the separate native mobile reader are outside this experiment.

## Validation

- Unit tests: chapter spans, edge bounds, short books, explicit confirmation,
  cancellation, bookmark persistence and stale asynchronous previews.
- Electron smoke: real worker, 20 pages including a landscape page, multiple
  previews, original scroll/zoom preservation, cancellation and navigation.
- `npm run check`, `npm run build`, `npm run build:mobile`,
  `npm run test:pdf:electron`.

The browser check rendered all 12 thumbnails and Close Look, kept page 1 on
cancel, and navigated to page 30 only on confirmation. The Electron smoke test
could not complete in this environment (Chromium shared-memory errors); rerun
it on the desktop before release. All 562 tests, types, architecture, desktop
and mobile builds passed.

Checkpoint before this experiment: `be3f442`. The experiment belongs on branch
`codex/bookedge-mvp`; switching back to `main` after saving changes restores the
checkpoint. Packaged Windows validation and subjective usability on real large
books remain manual release checks.
