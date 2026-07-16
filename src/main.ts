import { app, BrowserWindow, Tray, Menu, globalShortcut, protocol, net, ipcMain } from "electron";
import path from "path";
import { pathToFileURL } from "url";

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

let pinned = true;

function positionWindowUnderTray(): void {
  if (!tray || !win) return;
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height);
  win.setPosition(x, y, false);
}

function registerAppProtocol(): void {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const filePath = path.join(__dirname, "..", decodeURIComponent(url.pathname));
    return net.fetch(pathToFileURL(filePath).toString());
  });
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
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadURL("app://qrtray/index.html");
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win?.hide();
  });

  win.on("blur", () => {
    if (!pinned) win?.hide();
  });
}

function createTray(): void {
  tray = new Tray(path.join(__dirname, "..", "assets", "iconTemplate.png"));

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

function registerShortcut(): void {
  globalShortcut.register("CommandOrControl+Shift+Q", () => {
    toggleWindow();
  });
}

ipcMain.on("set-pinned", (_event, value: boolean) => {
  pinned = value;
});

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();
  createTray();
  registerShortcut();
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
