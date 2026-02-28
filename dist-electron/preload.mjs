"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getFilePath: () => {
    return new Promise((resolve) => {
      electron.ipcRenderer.once("file-opened", (_, filePath) => resolve(filePath));
      electron.ipcRenderer.send("open-file-dialog");
    });
  }
});
electron.contextBridge.exposeInMainWorld("api", {
  addDocument: (data) => electron.ipcRenderer.invoke("add-document", data),
  getDocuments: () => electron.ipcRenderer.invoke("get-documents"),
  saveReadingState: (payload) => electron.ipcRenderer.invoke("reading:save", payload),
  getReadingState: (fileHash) => electron.ipcRenderer.invoke("reading:get", fileHash),
  openPdf: () => electron.ipcRenderer.invoke("dialog:open-pdf"),
  getLastDocument: () => electron.ipcRenderer.invoke("app:get-last-document"),
  // ✅ novo
  reopenPdf: (filePath) => electron.ipcRenderer.invoke("pdf:reopen", filePath)
  // ✅ novo
});
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(
      channel,
      (event, ...args2) => listener(event, ...args2)
    );
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
