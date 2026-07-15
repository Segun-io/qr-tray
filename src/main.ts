import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain } from "electron";
import path from "path";
import { listCodes, addCode, deleteCode } from "./store";
import { textToQrDataUrl } from "./qr";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function positionWindowUnderTray(): void {
  if (!tray || !win) return;
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);
  win.setPosition(x, y, false);
}

function toggleWindow(): void {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    positionWindowUnderTray();
    win.show();
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 360,
    height: 480,
    show: false,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "index.html"));
  win.setAlwaysOnTop(true, "floating");

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win?.hide();
  });
}

function createTray(): void {
  tray = new Tray(path.join(__dirname, "..", "assets", "icon.png"));

  tray.on("click", () => {
    toggleWindow();
  });

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Salir",
        click: () => app.quit(),
      },
    ])
  );
}

function registerIpc(): void {
  ipcMain.handle("codes:list", () => listCodes());
  ipcMain.handle("codes:add", (_event, label: string, text: string) => addCode(label, text));
  ipcMain.handle("codes:delete", (_event, id: string) => deleteCode(id));
  ipcMain.handle("codes:qr", (_event, text: string) => textToQrDataUrl(text));
}

function registerShortcut(): void {
  globalShortcut.register("CommandOrControl+Shift+Q", () => {
    toggleWindow();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcut();
  registerIpc();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  console.log("window-all-closed disparado")
})

app.on("will-quit", () => {
  console.log("will quit disparado");
  globalShortcut.unregisterAll();
});
