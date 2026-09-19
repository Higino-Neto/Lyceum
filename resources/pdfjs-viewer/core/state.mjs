// Tiny ephemeral store shared across viewer features. Keeps per-reader state
// (custom selection, highlight list, ...) explicit instead of module globals.
export function createStateStore(initial = {}) {
  const store = { ...initial };
  return {
    get(key) {
      return store[key];
    },
    set(key, value) {
      store[key] = value;
    },
    update(patch) {
      Object.assign(store, patch);
    },
    clear() {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
  };
}