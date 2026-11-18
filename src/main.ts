import { app, BrowserWindow, Tray, Menu, globalShortcut, protocol, net, ipcMain, screen } from "electron";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

let pinned = true;

let movable = false;

let lang = "es";

const positionFile = path.join(app.getPath("userData"), "window-position.json");

function loadSavedPosition(): { x: number; y: number } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(positionFile, "utf-8"));
    if (typeof raw.x === "number" && typeof raw.y === "number") return raw;
  } catch {
  }
  return null;
}

function isPointOnScreen(x: number, y: number): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea ?? display.bounds;
    return (
      x >= area.x &&
      x < area.x + area.width &&
      y >= area.y &&
      y < area.y + area.height
    );
  });
}

function savePosition(x: number, y: number): void {
  fs.writeFileSync(positionFile, JSON.stringify({ x, y }));
}

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
    const root = path.resolve(__dirname, "..");
    const resolved = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(resolved).toString());
  });
}

function toggleWindow(): void {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    if (!movable) positionWindowUnderTray();
    if (process.platform === "darwin") app.focus({ steal: true });
    win.show();
    win.focus();
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
    movable: false,
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

  win.on("moved", () => {
    if (!movable || !win) return;
    const [x, y] = win.getPosition();
    savePosition(x, y);
  });
}

function updateTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: lang === "en" ? "Exit" : "Salir",
        click: () => app.quit(),
      },
    ])
  );
}

function createTray(): void {
  tray = new Tray(path.join(__dirname, "..", "assets", "iconTemplate.png"));

  tray.on("click", () => {
    toggleWindow();
  });

  updateTrayMenu();
}

function registerShortcut(): void {
  globalShortcut.register("CommandOrControl+Shift+Q", () => {
    toggleWindow();
  });
}

ipcMain.on("set-pinned", (_event, value: boolean) => {
  pinned = value;
});

ipcMain.on("set-movable", (_event, value: boolean) => {
  movable = value;
  win?.setMovable(value);
  if (value) {
    const saved = loadSavedPosition();
    if (saved && win && isPointOnScreen(saved.x, saved.y)) {
      win.setPosition(saved.x, saved.y, false);
    }
  }
});

ipcMain.on("set-lang", (_event, value: string) => {
  lang = value === "en" ? "en" : "es";
  updateTrayMenu();
});

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.hide();
  registerAppProtocol();
  createWindow();
  createTray();
  registerShortcut();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
