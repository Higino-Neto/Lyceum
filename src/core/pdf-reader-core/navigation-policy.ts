import type { NavigateState } from "./contract";

export type NavigationMode = "navigate" | "restore";

export interface NavigationIntent {
  state: NavigateState;
  mode: NavigationMode;
}

export type NavigationDecision =
  | { kind: "apply" }
  | { kind: "skip" }
  | { kind: "defer" };

/**
 * Owns the restore-vs-navigate ordering rules that Lyceum can neither move nor
 * delete from PDF.js: a user navigation always wins over a queued restore, and
 * a restore is meaningless once the reader navigated on its own.
 *
 * Pure and synchronous so it can be unit-tested without a viewer.
 */
export interface NavigationGuard {
  readonly userNavigated: boolean;
  decide(mode: NavigationMode, documentReady: boolean): NavigationDecision;
  wait(state: NavigateState, mode: NavigationMode): void;
  consumePending(): NavigationIntent | null;
}

export function createNavigationGuard(): NavigationGuard {
  let userNavigated = false;
  let pending: NavigationIntent | null = null;

  return {
    get userNavigated() {
      return userNavigated;
    },

    decide(mode, documentReady) {
      if (!documentReady) {
        // Document not ready yet: queue and apply once it has loaded.
        if (mode === "navigate") {
          userNavigated = true;
        }
        return mode === "navigate" || !userNavigated ? { kind: "defer" } : { kind: "skip" };
      }

      // Once the reader navigated on its own, a restore must not clobber it
      // (this also guards against a late iframe `onLoad` firing after a click).
      if (mode === "restore" && userNavigated) {
        return { kind: "skip" };
      }

      if (mode === "navigate") {
        userNavigated = true;
      }

      return { kind: "apply" };
    },

    wait(state, mode) {
      pending = { state, mode };
    },

    consumePending() {
      const next = pending;
      pending = null;
      return next;
    },
  };
}