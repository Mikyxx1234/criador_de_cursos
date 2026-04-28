import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  applyToken,
  getCurrentTokenInfo,
  login,
  logoutLocal,
} from "@/services/authService";
import { parseApiError, pingApi } from "@/services/apiClient";

interface RenewTokenModalProps {
  open: boolean;
  onClose: () => void;
  onTokenChanged?: () => void;
}

type Mode = "login" | "manual";

const DEFAULT_EMAIL = "admin@curso-platform.com";

export function RenewTokenModal({
  open,
  onClose,
  onTokenChanged,
}: RenewTokenModalProps) {
  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual paste state
  const [manualToken, setManualToken] = useState("");

  // Diagnóstico do token atualmente em uso
  const [tokenInfo, setTokenInfo] = useState(() => getCurrentTokenInfo());
  const [pingState, setPingState] = useState<{
    loading: boolean;
    ok?: boolean;
    message?: string;
  }>({ loading: false });

  const refreshTokenInfo = () => setTokenInfo(getCurrentTokenInfo());

  useEffect(() => {
    if (open) {
      refreshTokenInfo();
      setPingState({ loading: false });
    }
  }, [open]);

  const sourceBadge = useMemo(() => {
    if (tokenInfo.source === "storage") {
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" /> Token renovado
        </Badge>
      );
    }
    if (tokenInfo.source === "env") {
      return <Badge tone="warning">Token do .env</Badge>;
    }
    return <Badge tone="danger">Sem token</Badge>;
  }, [tokenInfo.source]);

  const handlePing = async () => {
    setPingState({ loading: true });
    const r = await pingApi();
    setPingState({
      loading: false,
      ok: r.ok,
      message: r.ok
        ? `OK (HTTP ${r.status})`
        : `${r.message || "Falha"}${r.status ? ` (HTTP ${r.status})` : ""}`,
    });
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Informe e-mail e senha de admin.");
      return;
    }
    setSubmitting(true);
    try {
      const p = login({ email: email.trim(), password });
      toast.promise(p, {
        loading: "Autenticando na API...",
        success: "Token renovado com sucesso!",
        error: (err) => parseApiError(err).message || "Falha ao autenticar",
      });
      const result = await p;
      applyToken(result.token);
      setPassword("");
      refreshTokenInfo();
      onTokenChanged?.();
      onClose();
    } catch {
      // erro tratado pelo toast.promise
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyManual = () => {
    const trimmed = manualToken.trim();
    if (!trimmed) {
      toast.error("Cole um token válido antes de aplicar.");
      return;
    }
    if (trimmed.length < 20) {
      toast.error("Esse token parece curto demais. Verifique o valor copiado.");
      return;
    }
    applyToken(trimmed);
    setManualToken("");
    refreshTokenInfo();
    toast.success("Token aplicado. Suas próximas requisições já usarão ele.");
    onTokenChanged?.();
    onClose();
  };

  const handleClearStoredToken = () => {
    logoutLocal();
    refreshTokenInfo();
    toast("Token salvo removido. Voltamos ao token padrão (.env).");
    onTokenChanged?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Renovar token da API"
      description="Use suas credenciais de admin para gerar um novo token Sanctum, ou cole um token manualmente. O token será salvo no navegador e usado em todas as próximas requisições."
      size="lg"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-5 w-5 text-brand-600 mt-0.5" />
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">
                  Token em uso:
                </span>
                {sourceBadge}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                {tokenInfo.preview}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePing}
              loading={pingState.loading}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Testar
            </Button>
            {tokenInfo.source === "storage" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearStoredToken}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Limpar salvo
              </Button>
            )}
          </div>
        </div>

        {pingState.message && (
          <div
            className={
              "rounded-lg border px-3 py-2 text-xs " +
              (pingState.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800")
            }
          >
            {pingState.ok
              ? "Conexão com a API confirmada: "
              : "Falha ao conectar: "}
            {pingState.message}
          </div>
        )}

        <div className="flex items-center gap-1 border-b border-slate-200">
          <ModeTab
            active={mode === "login"}
            onClick={() => setMode("login")}
            icon={<LogIn className="h-4 w-4" />}
          >
            Fazer login
          </ModeTab>
          <ModeTab
            active={mode === "manual"}
            onClick={() => setMode("manual")}
            icon={<KeyRound className="h-4 w-4" />}
          >
            Colar token manualmente
          </ModeTab>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="E-mail do admin"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="renew-password">
                Senha<span className="text-rose-500 ml-0.5">*</span>
              </label>
              <div className="relative">
                <input
                  id="renew-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 w-full pr-10 px-3.5 rounded-xl border border-slate-300 hover:border-slate-400 focus:border-brand-500 bg-white text-sm text-slate-900 placeholder:text-slate-400 transition-colors"
                  placeholder="Sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <span className="hint">
                Endpoint: <code>POST /auth/login</code>. Ao logar, o token
                Sanctum é gerado e salvo no navegador.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={submitting}
                icon={<RefreshCw className="h-4 w-4" />}
              >
                Renovar token
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="manual-token">
                Token Sanctum
              </label>
              <textarea
                id="manual-token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Ex.: 8|iRiklI3jtl2x8PzMu2ugiYIClH8vg3EwfwhSQeCb485d5964"
                className="min-h-24 px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 focus:border-brand-500 bg-white text-sm font-mono text-slate-900 placeholder:text-slate-400 transition-colors"
                spellCheck={false}
              />
              <span className="hint">
                Útil quando você já gerou um token em outro lugar (por exemplo
                via curl/postman) e só quer aplicá-lo aqui.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleApplyManual}
                icon={<KeyRound className="h-4 w-4" />}
              >
                Aplicar token
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
        (active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300")
      }
    >
      {icon}
      {children}
    </button>
  );
}
