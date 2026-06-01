type ThumbnailValue = string | undefined;
type ThumbnailSubscriber = (thumbnail: ThumbnailValue) => void;
type ThumbnailPriority = "visible" | "idle";
type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type IdleHandle = number | TimeoutHandle;

const MAX_CACHE_ENTRIES = 500;
const BATCH_SIZE = 48;
const VISIBLE_BATCH_DELAY_MS = 16;

interface ThumbnailApi {
  getThumbnail?: (thumbnailPath: string) => Promise<string | null>;
  getThumbnails?: (thumbnailPaths: string[]) => Promise<Record<string, string | null>>;
}

function getThumbnailApi(): ThumbnailApi {
  return (window.api || {}) as ThumbnailApi;
}

function scheduleIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    return window.requestIdleCallback(callback, { timeout: 350 });
  }

  return globalThis.setTimeout(callback, 120);
}

function cancelIdle(handle: IdleHandle) {
  if ("cancelIdleCallback" in window) {
    window.cancelIdleCallback(handle as number);
    return;
  }

  globalThis.clearTimeout(handle as TimeoutHandle);
}

class RendererThumbnailCache {
  private cache = new Map<string, string | null>();
  private subscribers = new Map<string, Set<ThumbnailSubscriber>>();
  private queued = new Set<string>();
  private inFlight = new Set<string>();
  private visibleTimer: TimeoutHandle | null = null;
  private idleTimer: IdleHandle | null = null;

  get(thumbnailPath: string | null | undefined): ThumbnailValue {
    if (!thumbnailPath || !this.cache.has(thumbnailPath)) return undefined;

    const value = this.cache.get(thumbnailPath) ?? null;
    this.cache.delete(thumbnailPath);
    this.cache.set(thumbnailPath, value);
    return value ?? undefined;
  }

  load(thumbnailPath: string | null | undefined, priority: ThumbnailPriority = "visible") {
    if (
      !thumbnailPath ||
      this.cache.has(thumbnailPath) ||
      this.inFlight.has(thumbnailPath)
    ) {
      return;
    }

    this.queued.add(thumbnailPath);
    this.schedule(priority);
  }

  prefetch(thumbnailPaths: Array<string | null | undefined>) {
    for (const thumbnailPath of thumbnailPaths) {
      this.load(thumbnailPath, "idle");
    }
  }

  subscribe(thumbnailPath: string, subscriber: ThumbnailSubscriber) {
    let listeners = this.subscribers.get(thumbnailPath);
    if (!listeners) {
      listeners = new Set();
      this.subscribers.set(thumbnailPath, listeners);
    }

    listeners.add(subscriber);
    const cached = this.get(thumbnailPath);
    if (cached) subscriber(cached);

    return () => {
      listeners?.delete(subscriber);
      if (listeners?.size === 0) {
        this.subscribers.delete(thumbnailPath);
      }
    };
  }

  clear() {
    this.cache.clear();
    this.queued.clear();
    this.inFlight.clear();
    this.subscribers.clear();

    if (this.visibleTimer !== null) {
      globalThis.clearTimeout(this.visibleTimer);
      this.visibleTimer = null;
    }

    if (this.idleTimer !== null) {
      cancelIdle(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private schedule(priority: ThumbnailPriority) {
    if (priority === "visible") {
      if (this.visibleTimer !== null) return;
      this.visibleTimer = globalThis.setTimeout(() => {
        this.visibleTimer = null;
        void this.flush();
      }, VISIBLE_BATCH_DELAY_MS);
      return;
    }

    if (this.idleTimer !== null || this.visibleTimer !== null) return;
    this.idleTimer = scheduleIdle(() => {
      this.idleTimer = null;
      void this.flush();
    });
  }

  private async flush() {
    if (this.queued.size === 0) return;

    const paths = Array.from(this.queued)
      .filter((thumbnailPath) => !this.inFlight.has(thumbnailPath))
      .slice(0, BATCH_SIZE);

    if (paths.length === 0) return;

    for (const thumbnailPath of paths) {
      this.queued.delete(thumbnailPath);
      this.inFlight.add(thumbnailPath);
    }

    try {
      const thumbnails = await this.readBatch(paths);
      for (const thumbnailPath of paths) {
        this.set(thumbnailPath, thumbnails[thumbnailPath] ?? null);
      }
    } finally {
      for (const thumbnailPath of paths) {
        this.inFlight.delete(thumbnailPath);
      }

      if (this.queued.size > 0) {
        this.schedule("idle");
      }
    }
  }

  private async readBatch(paths: string[]) {
    const api = getThumbnailApi();
    if (api.getThumbnails) {
      return api.getThumbnails(paths);
    }

    const entries = await Promise.all(
      paths.map(async (thumbnailPath) => [
        thumbnailPath,
        api.getThumbnail ? await api.getThumbnail(thumbnailPath) : null,
      ] as const),
    );
    return Object.fromEntries(entries);
  }

  private set(thumbnailPath: string, value: string | null) {
    this.cache.set(thumbnailPath, value);
    this.evictIfNeeded();

    const listeners = this.subscribers.get(thumbnailPath);
    if (!listeners || value === null) return;

    for (const subscriber of listeners) {
      subscriber(value);
    }
  }

  private evictIfNeeded() {
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) return;
      this.cache.delete(oldest);
    }
  }
}

export const thumbnailCache = new RendererThumbnailCache();

export function resetThumbnailCacheForTests() {
  thumbnailCache.clear();
}
