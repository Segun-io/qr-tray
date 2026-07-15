import { app, BrowserWindow, Tray, globalShortcut } from "electron";
import path from "path";

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

function toggleWindow(): void {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 360,
    height: 480,
    show: false,
  });
  win.loadFile(path.join(__dirname, "..", "index.html"));

  win.on("close", (event) => {
    (console.log("close event disparado, isQuitting:"), event.preventDefault());
    win?.hide();
  });
}

function createTray(): void {
  tray = new Tray(path.join(__dirname, "..", "assets", "icon.png"));
  tray.on("click", () => {
    toggleWindow();
  });
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
});

app.on("before-quit", () => {
  console.log("before quit disparado");
});

app.on("window-all-closed", () => {
  console.log("window-all-closed disparado");
});

app.on("will-quit", () => {
  console.log("will quit disparado");
  globalShortcut.unregisterAll();
});
