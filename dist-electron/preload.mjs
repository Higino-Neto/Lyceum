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
  // addDocument: (data) => ipcRenderer.invoke("add-document", data),
  // getDocuments: () => ipcRenderer.invoke("get-documents"),
  // saveReadingState: (payload) => ipcRenderer.invoke("reading:save", payload),
  // getReadingState: (fileHash) => ipcRenderer.invoke("reading:get", fileHash),
  // openPdf: () => ipcRenderer.invoke("dialog:open-pdf"),
  // getLastDocument: () => ipcRenderer.invoke("app:get-last-document"),
  // reopenPdf: (filePath: string) => ipcRenderer.invoke("pdf:reopen", filePath),
  // getThumbnail: (thumbnailPath: string) =>
  //   ipcRenderer.invoke("thumbnail:get", thumbnailPath),
  // getLibraryPath: () => ipcRenderer.invoke("library:get-path"),
  addDocument: (data) => electron.ipcRenderer.invoke("add-document", data),
  getDocuments: (limit, offset) => electron.ipcRenderer.invoke("get-documents", limit, offset),
  saveReadingState: (payload) => electron.ipcRenderer.invoke("reading:save", payload),
  getReadingState: (fileHash) => electron.ipcRenderer.invoke("reading:get", fileHash),
  openPdf: () => electron.ipcRenderer.invoke("dialog:open-pdf"),
  getLastDocument: () => electron.ipcRenderer.invoke("app:get-last-document"),
  reopenPdf: (filePath) => electron.ipcRenderer.invoke("pdf:reopen", filePath),
  getThumbnail: (thumbnailPath) => electron.ipcRenderer.invoke("thumbnail:get", thumbnailPath),
  getLibraryPath: () => electron.ipcRenderer.invoke("library:get-path"),
  scanLibrary: () => electron.ipcRenderer.invoke("library:scan"),
  moveToLibrary: (filePath) => electron.ipcRenderer.invoke("library:move", filePath),
  openFileDialog: () => electron.ipcRenderer.invoke("dialog:open-file"),
  getDocumentsBySyncStatus: (synced) => electron.ipcRenderer.invoke("library:get-sync-status", synced),
  getCategories: () => electron.ipcRenderer.invoke("library:get-categories"),
  syncDocument: (fileHash, action, category) => electron.ipcRenderer.invoke("library:sync-document", fileHash, action, category),
  searchLocalBooks: (query) => electron.ipcRenderer.invoke("library:search-local", query)
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
