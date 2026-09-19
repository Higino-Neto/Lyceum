// Message bus. Events go up (`bus.emit`) and are also delivered to local
// `onEvent` listeners; commands come down (`bus.handleParentMessage`) and are
// dispatched to `onCommand` handlers. Transport is injected so the module stays
// testable in isolation.
import { isParentEvent } from "../lyceum-messaging.mjs";

export function createBus({ post = null, matchesParent = isParentEvent } = {}) {
  const commandHandlers = new Map();
  const eventListeners = new Map();

  function register(map, type, handler) {
    let list = map.get(type);
    if (!list) {
      list = [];
      map.set(type, list);
    }
    list.push(handler);
    return () => {
      const index = list.indexOf(handler);
      if (index >= 0) {
        list.splice(index, 1);
      }
    };
  }

  return {
    post,

    emit(type, payload = {}) {
      if (!post) {
        throw new Error("lyceum-bus: post transport is not wired");
      }
      post(type, payload);
      for (const listener of eventListeners.get(type) ?? []) {
        try {
          listener(payload);
        } catch {
          // Local listeners must never break the viewer.
        }
      }
    },

    onEvent(type, listener) {
      return register(eventListeners, type, listener);
    },

    onCommand(type, handler) {
      return register(commandHandlers, type, handler);
    },

    handleParentMessage(event) {
      if (!matchesParent(event)) {
        return;
      }
      const data = event.data;
      if (!data || typeof data.type !== "string") {
        return;
      }
      for (const handler of commandHandlers.get(data.type) ?? []) {
        try {
          const result = handler(data);
          if (result && typeof result.then === "function") {
            result.catch(() => {});
          }
        } catch {
          // A misbehaving feature must not take the whole reader down.
        }
      }
    },
  };
}