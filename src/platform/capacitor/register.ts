import { registerPlatform } from "..";
import { capacitorAuthStorage } from "./authStorage";
import { lazyMobileLearningBridge } from "../../mobile/learning/lazyLearningBridge";

/** Called first thing in `src/mobile/main.tsx`, before any shared module touches Supabase. */
export function registerCapacitorPlatform() {
  registerPlatform({
    target: "mobile",
    authStorage: capacitorAuthStorage,
    authFlowType: "pkce",
    clientInfo: `lyceum-mobile/${import.meta.env.VITE_APP_VERSION || "dev"}`,
    learningBridge: lazyMobileLearningBridge,
  });
}
