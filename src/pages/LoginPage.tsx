import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, LogIn, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface LoginPageProps {
  onAuthenticated?: () => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Informe email e senha.");
      return;
    }

    setSubmitting(true);
    try {
      // Pequeno delay para evitar brute-force trivial e dar feedback visual.
      await new Promise((r) => setTimeout(r, 350));
      const ok = await login(email, password);
      if (!ok) {
        setError("Email ou senha incorretos.");
        toast.error("Acesso negado", {
          description: "Verifique suas credenciais e tente novamente.",
        });
        return;
      }
      onAuthenticated?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-brand-50 via-white to-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lift mb-4">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Painel Eduit
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Faça login para gerenciar os cursos.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="card p-6 sm:p-8 flex flex-col gap-5"
          autoComplete="on"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="label">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="pl-9"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="label">
              Senha
            </label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="pl-9 pr-10"
                disabled={submitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            loading={submitting}
            icon={!submitting ? <LogIn className="h-4 w-4" /> : undefined}
            className="w-full"
          >
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Acesso restrito · Eduit
        </p>
      </div>
    </div>
  );
}
