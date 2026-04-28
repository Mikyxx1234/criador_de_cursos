import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  type AIFormatProgress,
  runFormattingAgent,
} from "@/services/aiFormatter";

type Phase = "idle" | "running" | "done" | "error";

interface AIFormattingPanelProps {
  courseId: number;
}

export function AIFormattingPanel({ courseId }: AIFormattingPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<AIFormatProgress[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    fixed: number;
    failed: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiKeyConfigured = Boolean(
    (import.meta.env.VITE_OPENAI_API_KEY || "").trim()
  );

  const handleStart = async () => {
    if (!apiKeyConfigured) {
      toast.error(
        "VITE_OPENAI_API_KEY não configurada. Adicione no .env / Easypanel e rebuild."
      );
      return;
    }
    setPhase("running");
    setLogs([]);
    setSummary(null);
    abortRef.current = new AbortController();

    try {
      const result = await runFormattingAgent(
        courseId,
        (p) => setLogs((prev) => [...prev, p]),
        { signal: abortRef.current.signal }
      );
      setSummary(result);
      if (result.failed === 0 && result.total > 0) {
        toast.success(`${result.fixed} artigo(s) revisado(s) pela IA.`);
      } else if (result.total === 0) {
        toast.info("Nenhum artigo encontrado para revisar.");
      } else {
        toast.warning(
          `Revisão parcial: ${result.fixed} OK, ${result.failed} falhou.`
        );
      }
      setPhase("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLogs((prev) => [
        ...prev,
        { type: "error", current: 0, total: 0, message: msg },
      ]);
      toast.error(`Falha ao revisar com IA: ${msg}`);
      setPhase("error");
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const lastProgress = logs[logs.length - 1];
  const pct =
    lastProgress && lastProgress.total > 0
      ? Math.round((lastProgress.current / lastProgress.total) * 100)
      : 0;

  return (
    <Card className="border-violet-200/60 bg-gradient-to-br from-violet-50/40 via-white to-brand-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <WandSparkles className="h-4 w-4 text-violet-600" />
          Revisar formatação dos artigos com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          Algumas tabelas e listas do Word podem ter sido importadas como
          parágrafos soltos. O agente analisa cada artigo deste curso e
          reconstrói a formatação (tabelas, listas, subtítulos) sem alterar o
          conteúdo. <strong>É opcional</strong> e gasta créditos da sua chave
          OpenAI.
        </p>

        {phase === "idle" && (
          <div className="flex justify-end">
            <Button
              onClick={handleStart}
              icon={<Sparkles className="h-4 w-4" />}
              disabled={!apiKeyConfigured}
              title={
                apiKeyConfigured
                  ? undefined
                  : "Configure VITE_OPENAI_API_KEY no .env"
              }
            >
              Revisar agora com IA
            </Button>
          </div>
        )}

        {(phase === "running" || phase === "done" || phase === "error") && (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              {phase === "running" && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                  <span>Revisando artigos...</span>
                </>
              )}
              {phase === "done" && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    {summary && summary.total === 0
                      ? "Nenhum artigo encontrado para revisar."
                      : `Revisão concluída — ${summary?.fixed ?? 0} corrigido(s), ${summary?.failed ?? 0} falha(s).`}
                  </span>
                </>
              )}
              {phase === "error" && (
                <>
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>Erro durante a revisão.</span>
                </>
              )}
            </div>

            {lastProgress && lastProgress.total > 0 && (
              <div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      phase === "error"
                        ? "bg-rose-500"
                        : phase === "done"
                          ? "bg-emerald-500"
                          : "bg-violet-600"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {lastProgress.current}/{lastProgress.total} artigo(s) ({pct}%)
                </p>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 p-4 max-h-72 overflow-auto font-mono text-xs leading-relaxed space-y-1">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.type === "error"
                      ? "text-rose-400"
                      : l.type === "success"
                        ? "text-emerald-400"
                        : "text-slate-300"
                  }
                >
                  {l.type === "success"
                    ? "✓ "
                    : l.type === "error"
                      ? "✗ "
                      : "• "}
                  <span className="whitespace-pre-wrap">{l.message}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              {phase === "running" && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              )}
              {(phase === "done" || phase === "error") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPhase("idle");
                    setLogs([]);
                    setSummary(null);
                  }}
                >
                  Rodar novamente
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
