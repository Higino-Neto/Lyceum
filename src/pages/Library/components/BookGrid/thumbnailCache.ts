export const thumbnailCache = {
  get: (_path: string | null | undefined): undefined => undefined,
  load: (_path: string | null | undefined, _priority?: "visible" | "idle") => {},
  prefetch: (_paths: Array<string | null | undefined>) => {},
  subscribe: (_path: string, _subscriber: (value: string | undefined) => void) => () => {},
  clear: () => {},
};

export function resetThumbnailCacheForTests() {}
