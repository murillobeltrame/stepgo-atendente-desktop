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
import { execFile } from "node:child_process";
import fs from "node:fs";
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

function normalizeApiBaseUrl(url: string) {
  const trimmed = url.trim().replace(/\/$/, "");
  if (
    trimmed === "https://stepgo.com.br" ||
    trimmed === "http://stepgo.com.br" ||
    trimmed === "https://www.stepgo.com.br" ||
    trimmed === "http://www.stepgo.com.br"
  ) {
    return "https://nivesistemas.com.br";
  }
  return trimmed || "https://nivesistemas.com.br";
}

const store = new Store<AppSettings>({
  defaults: {
    apiBaseUrl: "https://nivesistemas.com.br",
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
let queueTrackingReady = false;

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
    { label: "Nive Atendente", enabled: false },
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

  const base = "Nive Atendente";
  tray.setToolTip(
    waitingCount > 0 ? `${base} — ${waitingCount} na fila` : `${base} — online`,
  );
  tray.setContextMenu(buildTrayMenu());
}

function getNotificationSoundPath() {
  return path.join(__dirname, "../build/notification.wav");
}

function playNewAttendanceSound() {
  if (!store.get("soundEnabled")) return;

  const soundPath = getNotificationSoundPath();
  if (!fs.existsSync(soundPath) || process.platform !== "win32") return;

  const escapedPath = soundPath.replace(/'/g, "''");
  execFile(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `(New-Object System.Media.SoundPlayer '${escapedPath}').Play()`,
    ],
    { windowsHide: true },
    () => {},
  );
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Nive Atendente");
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

const conversationWindows = new Map<string, BrowserWindow>();

function loadRenderer(target: BrowserWindow, query?: Record<string, string>) {
  if (isDev) {
    const params = new URLSearchParams(query);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    void target.loadURL(`http://localhost:5173${suffix}`);
    return;
  }

  void target.loadFile(path.join(__dirname, "../dist/index.html"), { query });
}

function openConversationWindow(conversationId: string, title?: string) {
  const existing = conversationWindows.get(conversationId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return true;
  }

  const conversationWindow = new BrowserWindow({
    width: 760,
    height: 720,
    minWidth: 520,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    title: title ? `Atendimento — ${title}` : "Atendimento Nive",
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  loadRenderer(conversationWindow, { conversation: conversationId });

  conversationWindow.once("ready-to-show", () => {
    conversationWindow.show();
    conversationWindow.focus();
  });

  conversationWindow.on("closed", () => {
    conversationWindows.delete(conversationId);
  });

  conversationWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  conversationWindows.set(conversationId, conversationWindow);
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 480,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    title: "Nive Atendente",
    icon: path.join(__dirname, "../build/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    loadRenderer(mainWindow);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    loadRenderer(mainWindow);
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
  ipcMain.handle("settings:get", () => {
    const apiBaseUrl = normalizeApiBaseUrl(store.get("apiBaseUrl"));
    if (apiBaseUrl !== store.get("apiBaseUrl")) {
      store.set("apiBaseUrl", apiBaseUrl);
    }

    return {
      apiBaseUrl,
    token: store.get("token"),
    adminName: store.get("adminName"),
    autoStartMinimized: store.get("autoStartMinimized"),
    soundEnabled: store.get("soundEnabled"),
    };
  });

  ipcMain.handle("settings:set", (_event, partial: Partial<AppSettings>) => {
    if (partial.apiBaseUrl !== undefined) {
      store.set("apiBaseUrl", normalizeApiBaseUrl(partial.apiBaseUrl));
    }
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

  ipcMain.handle("shell:open-external", (_event, url: string) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle("api:request", (_event, payload: ApiRequestPayload) => proxyApiRequest(payload));

  ipcMain.handle("conversation:open", (_event, payload: { id: string; title?: string }) => {
    if (!payload?.id) return false;
    return openConversationWindow(payload.id, payload.title);
  });

  ipcMain.handle("conversation:set-title", (event, title: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window === mainWindow) return false;
    window.setTitle(title ? `Atendimento — ${title}` : "Atendimento Nive");
    return true;
  });

  ipcMain.on("queue:update", (_event, payload: { waitingCount: number }) => {
    const count = payload.waitingCount ?? 0;
    const hasNewWaiting = queueTrackingReady && count > lastWaitingCount;

    if (hasNewWaiting) {
      if (Notification.isSupported()) {
        new Notification({
          title: "Novo atendimento na fila",
          body:
            count === 1
              ? "1 lojista aguardando atendimento humano."
              : `${count} lojistas aguardando atendimento humano.`,
          silent: true,
        }).show();
      }
      playNewAttendanceSound();
    }

    queueTrackingReady = true;
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
