import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("qrtray", {
  setPinned: (pinned: boolean) => ipcRenderer.send("set-pinned", pinned),
});
