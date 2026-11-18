import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("qrtray", {
  setPinned: (pinned: boolean) => ipcRenderer.send("set-pinned", pinned),
  setMovable: (movable: boolean) => ipcRenderer.send("set-movable", movable),
  setLang: (lang: string) => ipcRenderer.send("set-lang", lang),
});
