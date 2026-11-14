export const WATCHER_IGNORED_PATTERNS = [
  // OS file explorer artifacts written when the managed folder is opened
  // outside the app (Explorer, Nautilus, Dolphin, Finder…). Without these the
  // watcher storms the renderer with changes right after "Open library folder".
  "**/Thumbs.db",
  "**/desktop.ini",
  "**/.DS_Store",
  "**/*.tmp",
  "**/*.temp",
  "**/*.partial",
  "**/.*.tmp",
  // Hidden files and directories are always treated as noise: the library tree
  // UI already filters them out and moving a hidden temp file never should
  // trigger a full library refresh.
  "**/.*",
];
