import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  Notification,
  ipcMain,
  shell,
} from "electron";
import path from "node:path";
import Store from "electron-store";
import { proxyApiRequest, type ApiRequestPayload } from "./api-proxy";

type AppSettings = {
  apiBaseUrl: string;
  token: string | null;
  adminName: string | null;
  autoStartMinimized: boolean;
  soundEnabled: boolean;
};

const store = new Store<AppSettings>({
  defaults: {
    apiBaseUrl: "https://stepgo.com.br",
    token: null,
    adminName: null,
    autoStartMinimized: true,
    soundEnabled: true,
  },
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let lastWaitingCount = 0;

const isDev = !app.isPackaged;

function getTrayIconPath() {
  return path.join(__dirname, isDev ? "../build/tray.png" : "../build/tray.png");
}

function createTrayIcon() {
  const iconPath = getTrayIconPath();
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    image = nativeImage.createEmpty();
  }
  return image.resize({ width: 16, height: 16 });
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  mainWindow?.hide();
}

function buildTrayMenu() {
  const waitingLabel =
    lastWaitingCount > 0
      ? `Fila de espera (${lastWaitingCount})`
      : "Nenhum atendimento na fila";

  return Menu.buildFromTemplate([
    { label: "StepGo Atendente", enabled: false },
    { type: "separator" },
    { label: waitingLabel, enabled: false },
    {
      label: "Abrir painel",
      click: () => showMainWindow(),
    },
    {
      label: "Configurações",
      click: () => {
        showMainWindow();
        mainWindow?.webContents.send("navigate", "/settings");
      },
    },
    { type: "separator" },
    {
      label: "Sair",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function updateTrayTooltip(waitingCount: number) {
  lastWaitingCount = waitingCount;
  if (!tray) return;

  const base = "StepGo Atendente";
  tray.setToolTip(
    waitingCount > 0 ? `${base} — ${waitingCount} na fila` : `${base} — online`,
  );
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("StepGo Atendente");
  tray.setContextMenu(buildTrayMenu());

  tray.on("double-click", () => showMainWindow());
  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      hideMainWindow();
    } else {
      showMainWindow();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: "StepGo Atendente",
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    const autoStartMinimized = store.get("autoStartMinimized");
    if (!autoStartMinimized) {
      mainWindow?.show();
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideMainWindow();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

function registerIpc() {
  ipcMain.handle("settings:get", () => ({
    apiBaseUrl: store.get("apiBaseUrl"),
    token: store.get("token"),
    adminName: store.get("adminName"),
    autoStartMinimized: store.get("autoStartMinimized"),
    soundEnabled: store.get("soundEnabled"),
  }));

  ipcMain.handle("settings:set", (_event, partial: Partial<AppSettings>) => {
    if (partial.apiBaseUrl !== undefined) store.set("apiBaseUrl", partial.apiBaseUrl);
    if (partial.token !== undefined) store.set("token", partial.token);
    if (partial.adminName !== undefined) store.set("adminName", partial.adminName);
    if (partial.autoStartMinimized !== undefined) {
      store.set("autoStartMinimized", partial.autoStartMinimized);
    }
    if (partial.soundEnabled !== undefined) store.set("soundEnabled", partial.soundEnabled);
    return true;
  });

  ipcMain.handle("settings:clear-session", () => {
    store.set("token", null);
    store.set("adminName", null);
    return true;
  });

  ipcMain.handle("app:show", () => {
    showMainWindow();
    return true;
  });

  ipcMain.handle("api:request", (_event, payload: ApiRequestPayload) => proxyApiRequest(payload));

  ipcMain.on("queue:update", (_event, payload: { waitingCount: number }) => {
    const count = payload.waitingCount ?? 0;
    if (count > lastWaitingCount && Notification.isSupported()) {
      new Notification({
        title: "Novo atendimento na fila",
        body:
          count === 1
            ? "1 lojista aguardando atendimento humano."
            : `${count} lojistas aguardando atendimento humano.`,
        silent: !store.get("soundEnabled"),
      }).show();
    }
    updateTrayTooltip(count);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(() => {
    createWindow();
    createTray();
    registerIpc();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        showMainWindow();
      }
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("window-all-closed", () => {
    // Mantém rodando na bandeja no Windows
  });
}
