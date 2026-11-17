import { useEffect } from "react";
import { createDesktopLearningClient } from "../language-learning/learningClient";
import { sendBooksToDevices, startDeviceSync, type ReceiveOutcome } from "./syncController";

/** Desktop: background device sync while signed in. */
export function useDesktopDeviceSync(signedInUserId: string | null | undefined) {
  useEffect(() => {
    if (!signedInUserId || !window.api?.deviceSyncSaveBook) return undefined;
    return startDeviceSync({
      platform: "desktop",
      learningClient: (userId) => createDesktopLearningClient(userId),
      async receiveBook(file): Promise<ReceiveOutcome> {
        const result = await window.api.deviceSyncSaveBook(file.name, new Uint8Array(await file.arrayBuffer()));
        if ("error" in result) throw new Error(result.error);
        return result.duplicate ? "duplicate" : "imported";
      },
    });
  }, [signedInUserId]);
}

/** Desktop: sends library files (by hash) to the user's other devices. */
export function sendDesktopBooksToDevices(files: Array<{ fileHash: string; fileName: string }>) {
  return sendBooksToDevices("desktop", files.map((file) => ({
    fileName: file.fileName,
    async load() {
      const result = await window.api.deviceSyncReadBook(file.fileHash);
      if ("error" in result) throw new Error(result.error);
      return result.bytes;
    },
  })));
}
