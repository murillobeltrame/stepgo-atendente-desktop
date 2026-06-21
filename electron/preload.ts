import { contextBridge, ipcRenderer } from "electron";

export type AppSettings = {
  apiBaseUrl: string;
  token: string | null;
  adminName: string | null;
  autoStartMinimized: boolean;
  soundEnabled: boolean;
};

contextBridge.exposeInMainWorld("stepgoDesktop", {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  setSettings: (partial: Partial<AppSettings>): Promise<boolean> =>
    ipcRenderer.invoke("settings:set", partial),
  clearSession: (): Promise<boolean> => ipcRenderer.invoke("settings:clear-session"),
  showApp: (): Promise<boolean> => ipcRenderer.invoke("app:show"),
  updateQueue: (waitingCount: number) =>
    ipcRenderer.send("queue:update", { waitingCount }),
  onNavigate: (callback: (path: string) => void) => {
    const listener = (_event: unknown, routePath: string) => callback(routePath);
    ipcRenderer.on("navigate", listener);
    return () => ipcRenderer.removeListener("navigate", listener);
  },
});
