import { useState } from "react";
import { Loader2 } from "lucide-react";
import brandIconUrl from "../../build/brand/icon-source.png";
import { login, recoverTwoFactor, verifyTwoFactor } from "@/lib/api";
import type { AdminInfo } from "@/types";

type Props = {
  apiBaseUrl: string;
  onLogin: (token: string, admin: AdminInfo) => Promise<void>;
};

type Step = "credentials" | "two-factor" | "recover";

export function LoginPage({ apiBaseUrl, onLogin }: Props) {
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishLogin = async (token: string, admin: AdminInfo) => {
    await onLogin(token, admin);
  };

  const handleCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await login(email.trim(), password);
      if (result.kind === "two-factor") {
        setPendingToken(result.pendingToken);
        setStep("two-factor");
        return;
      }
      await finishLogin(result.token, result.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await verifyTwoFactor(pendingToken, code.trim());
      await finishLogin(result.token, result.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await recoverTwoFactor(pendingToken, backupCode.trim());
      await finishLogin(result.token, result.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <img
            src={brandIconUrl}
            alt="Nive"
            width={42}
            height={42}
            style={{ borderRadius: 12, objectFit: "contain" }}
          />
          <div>
            <h2>Nive Atendente</h2>
            <p style={{ margin: 0 }}>Entre com sua conta de administrador</p>
          </div>
        </div>

        <p style={{ fontSize: "0.78rem", marginBottom: 18 }}>
          Servidor: <strong>{apiBaseUrl}</strong>
        </p>

        {step === "credentials" ? (
          <form onSubmit={handleCredentials}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? <Loader2 size={16} className="spin" /> : null}
              Entrar
            </button>
          </form>
        ) : null}

        {step === "two-factor" ? (
          <form onSubmit={handleTwoFactor}>
            <p style={{ marginBottom: 14, fontSize: "0.88rem" }}>
              Informe o código do autenticador de dois fatores.
            </p>
            <div className="field">
              <label htmlFor="code">Código 2FA</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? <Loader2 size={16} /> : null}
              Verificar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => setStep("recover")}
            >
              Usar código de recuperação
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "100%", marginTop: 4 }}
              onClick={() => {
                setStep("credentials");
                setCode("");
              }}
            >
              Voltar
            </button>
          </form>
        ) : null}

        {step === "recover" ? (
          <form onSubmit={handleRecover}>
            <div className="field">
              <label htmlFor="backup">Código de recuperação</label>
              <input
                id="backup"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? <Loader2 size={16} /> : null}
              Recuperar acesso
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => setStep("two-factor")}
            >
              Voltar
            </button>
          </form>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </div>
  );
}
