import { useState } from "react";
import type { AppSettings } from "@/types";

type Props = {
  settings: AppSettings;
  onSave: (partial: Partial<AppSettings>) => Promise<void>;
  onBack: () => void;
};

export function SettingsPage({ settings, onSave, onBack }: Props) {
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [autoStartMinimized, setAutoStartMinimized] = useState(settings.autoStartMinimized);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onSave({
        apiBaseUrl: apiBaseUrl.trim().replace(/\/$/, ""),
        autoStartMinimized,
        soundEnabled,
      });
      setMessage("Configurações salvas.");
    } catch {
      setMessage("Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 12 }}>
        ← Voltar ao atendimento
      </button>

      <div className="card" style={{ padding: 20 }}>
        <h2>Configurações</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="api-url">URL do servidor StepGo</label>
            <input
              id="api-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://nivesistemas.com.br"
              required
            />
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Use o endereço do site onde o painel admin está hospedado.
            </span>
          </div>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={autoStartMinimized}
              onChange={(e) => setAutoStartMinimized(e.target.checked)}
            />
            Iniciar minimizado na bandeja ao abrir o app
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            Tocar som nas notificações de nova fila
          </label>

          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </form>

        {message ? (
          <p style={{ marginTop: 12, fontSize: "0.85rem", color: "var(--muted)" }}>{message}</p>
        ) : null}
      </div>
    </div>
  );
}
