import { contextBridge, ipcRenderer } from "electron";
import type { QrRecord } from "./types";

contextBridge.exposeInMainWorld("api", {
  listCodes: (): Promise<QrRecord[]> => ipcRenderer.invoke("codes:list"),
  addCode: (label: string, text: string): Promise<QrRecord> =>
    ipcRenderer.invoke("codes:add", label, text),
  deleteCode: (id: string): Promise<void> => ipcRenderer.invoke("codes:delete", id),
  generateQr: (text: string): Promise<string> => ipcRenderer.invoke("codes:qr", text),
});
