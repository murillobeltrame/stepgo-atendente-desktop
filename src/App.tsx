import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConversationPanel } from "@/components/ConversationPanel";
import { LoginPage } from "@/components/LoginPage";
import { SettingsPage } from "@/components/SettingsPage";
import { SupportQueue } from "@/components/SupportQueue";
import { configureApi } from "@/lib/api";
import type { AdminInfo, AppSettings } from "@/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

type View = "inbox" | "settings";

function getConversationIdFromUrl() {
  return new URLSearchParams(window.location.search).get("conversation");
}

export function App() {
  const conversationId = useMemo(() => getConversationIdFromUrl(), []);
  const isConversationWindow = Boolean(conversationId);

  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [view, setView] = useState<View>("inbox");
  const [admin, setAdmin] = useState<AdminInfo | null>(null);

  useEffect(() => {
    void window.stepgoDesktop.getSettings().then((loaded) => {
      setSettings(loaded);
      configureApi(loaded.apiBaseUrl, loaded.token);
      if (loaded.token) {
        setAdmin({
          id: "session",
          name: loaded.adminName ?? "Atendente",
        });
      }
      setReady(true);
    });

    if (!isConversationWindow) {
      return window.stepgoDesktop.onNavigate((path) => {
        if (path.includes("settings")) setView("settings");
      });
    }

    return undefined;
  }, [isConversationWindow]);

  const handleLogin = async (token: string, loggedAdmin: AdminInfo) => {
    await window.stepgoDesktop.setSettings({
      token,
      adminName: loggedAdmin.name,
    });
    configureApi(settings?.apiBaseUrl ?? "https://stepgo.com.br", token);
    setAdmin(loggedAdmin);
    setView("inbox");
    void queryClient.clear();
  };

  const handleLogout = async () => {
    await window.stepgoDesktop.clearSession();
    configureApi(settings?.apiBaseUrl ?? "https://stepgo.com.br", null);
    setAdmin(null);
    void queryClient.clear();
  };

  const handleSaveSettings = async (partial: Partial<AppSettings>) => {
    await window.stepgoDesktop.setSettings(partial);
    const next = await window.stepgoDesktop.getSettings();
    setSettings(next);
    configureApi(next.apiBaseUrl, next.token);
  };

  const handleQueueUpdate = useCallback((waitingCount: number) => {
    window.stepgoDesktop.updateQueue(waitingCount);
  }, []);

  if (!ready || !settings) {
    return <div className="empty-state">Carregando…</div>;
  }

  if (!settings.token || !admin) {
    return <LoginPage apiBaseUrl={settings.apiBaseUrl} onLogin={handleLogin} />;
  }

  if (isConversationWindow && conversationId) {
    return <ConversationPanel conversationId={conversationId} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Atendimento humano</h1>
          <p>
            Olá, {admin.name}. Cada atendimento abre em uma janela separada para você atender
            vários ao mesmo tempo.
          </p>
        </div>
        <div className="header-actions">
          <span className="status-badge">Online</span>
          <button type="button" className="btn btn-secondary" onClick={() => setView("settings")}>
            <Settings size={16} />
            Configurações
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleLogout()}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      {view === "settings" ? (
        <SettingsPage
          settings={settings}
          onSave={handleSaveSettings}
          onBack={() => setView("inbox")}
        />
      ) : (
        <SupportQueue onQueueUpdate={handleQueueUpdate} />
      )}
    </div>
  );
}

export function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
