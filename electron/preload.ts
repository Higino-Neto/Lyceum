import { ipcRenderer, contextBridge } from "electron";
import { addDocument } from "./local-database";

contextBridge.exposeInMainWorld("electronAPI", {
  getFilePath: () => {
    return new Promise((resolve) => {
      ipcRenderer.once("file-opened", (_, filePath) => resolve(filePath));
      ipcRenderer.send("open-file-dialog");
    });
  },
});

contextBridge.exposeInMainWorld("api", {
  addDocument: (data) => ipcRenderer.invoke("add-document", data),
  getDocuments: () => ipcRenderer.invoke("get-documents"),
  saveReadingState: (payload) => ipcRenderer.invoke("reading:save", payload),
  getReadingState: (fileHash) => ipcRenderer.invoke("reading:get", fileHash),
  openPdf: () => ipcRenderer.invoke("dialog:open-pdf"),
  getLastDocument: () => ipcRenderer.invoke("app:get-last-document"), // ✅ novo
  reopenPdf: (filePath: string) => ipcRenderer.invoke("pdf:reopen", filePath), // ✅ novo
});

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) =>
      listener(event, ...args),
    );
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});
