import { contextBridge, ipcRenderer } from "electron";
import type { ApiRequestPayload, ApiRequestResult } from "./api-proxy";

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
  apiRequest: (payload: ApiRequestPayload): Promise<ApiRequestResult> =>
    ipcRenderer.invoke("api:request", payload),
  openConversation: (id: string, title?: string): Promise<boolean> =>
    ipcRenderer.invoke("conversation:open", { id, title }),
  setConversationTitle: (title: string): Promise<boolean> =>
    ipcRenderer.invoke("conversation:set-title", title),
  showApp: (): Promise<boolean> => ipcRenderer.invoke("app:show"),
  openExternalUrl: (url: string): Promise<boolean> =>
    ipcRenderer.invoke("shell:open-external", url),
  updateQueue: (waitingCount: number) =>
    ipcRenderer.send("queue:update", { waitingCount }),
  onNavigate: (callback: (path: string) => void) => {
    const listener = (_event: unknown, routePath: string) => callback(routePath);
    ipcRenderer.on("navigate", listener);
    return () => ipcRenderer.removeListener("navigate", listener);
  },
});
