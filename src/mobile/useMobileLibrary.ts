import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { hydrateMobileState, loadMobileState, saveMobileState } from "./storage";
import type { MobileLibraryState } from "./types";
export function useMobileLibrary() {
  const [state, setState] = useState<MobileLibraryState>(() => loadMobileState());
  const stateRef = useRef(state);
  const [repositoryReady, setRepositoryReady] = useState(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!repositoryReady) return;
    void saveMobileState(state).catch((error) => {
      console.error("[mobile-storage] persist failed", error);
      toast.error("Nao foi possivel salvar as ultimas alteracoes no aparelho.", { id: "mobile-storage-error" });
    });
  }, [repositoryReady, state]);

  useEffect(() => {
    let cancelled = false;
    hydrateMobileState().then((hydrated) => {
      if (!cancelled) {
        setState(hydrated);
        setRepositoryReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, setState, stateRef, repositoryReady };
}
