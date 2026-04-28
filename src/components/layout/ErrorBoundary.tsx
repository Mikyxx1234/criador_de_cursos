import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, LogOut, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Chamado quando o usuário clica em "Voltar para a lista" — reseta
   * qualquer state local relacionado à navegação (chave de view,
   * builder, etc.). O componente fará reload completo após.
   */
  onResetSession?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] crash capturado:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetSession = () => {
    this.props.onResetSession?.();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Algo travou ao carregar essa tela
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Tivemos um erro inesperado renderizando o painel. Você pode
            recarregar a página ou voltar para a lista de cursos para
            continuar.
          </p>

          <details className="text-left mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-500">
              {this.state.error?.message || String(this.state.error)}
            </pre>
          </details>

          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
            <Button
              variant="outline"
              onClick={this.handleResetSession}
              icon={<LogOut className="h-4 w-4" />}
            >
              Voltar para a lista
            </Button>
            <Button
              onClick={this.handleReload}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Recarregar página
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
