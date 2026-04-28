import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/Card";

type Status = "idle" | "loading" | "ok" | "missing" | "failed";

interface CoverImageDiagnosticProps {
  coverImageUrl?: string | null;
}

export function CoverImageDiagnostic({
  coverImageUrl,
}: CoverImageDiagnosticProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!coverImageUrl) {
      setStatus("missing");
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setStatus("ok");
    };
    img.onerror = () => {
      if (cancelled) return;
      setStatus("failed");
      setErrorMessage(
        "O backend salvou o curso mas a URL da capa não carregou. " +
          "Pode ser 404 (falta de symlink no storage), CORS, ou APP_URL errada no backend."
      );
    };
    img.src = coverImageUrl;

    return () => {
      cancelled = true;
    };
  }, [coverImageUrl]);

  const copyUrl = async () => {
    if (!coverImageUrl) return;
    try {
      await navigator.clipboard.writeText(coverImageUrl);
      toast.success("URL copiada");
    } catch {
      toast.error("Não consegui copiar");
    }
  };

  if (status === "idle") return null;

  const tone = {
    missing: {
      bg: "bg-amber-50 border-amber-200",
      icon: <ImageOff className="h-4 w-4 text-amber-600" />,
      title: "Capa não retornada pela API",
      color: "text-amber-800",
    },
    loading: {
      bg: "bg-slate-50 border-slate-200",
      icon: <Loader2 className="h-4 w-4 text-slate-500 animate-spin" />,
      title: "Verificando se a capa é acessível...",
      color: "text-slate-700",
    },
    ok: {
      bg: "bg-emerald-50 border-emerald-200",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      title: "Capa carregando corretamente",
      color: "text-emerald-800",
    },
    failed: {
      bg: "bg-rose-50 border-rose-200",
      icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
      title: "A URL da capa não abre",
      color: "text-rose-800",
    },
  }[status];

  return (
    <Card className={tone.bg}>
      <CardContent className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          {tone.icon}
          <span className={`text-sm font-semibold ${tone.color}`}>
            {tone.title}
          </span>
        </div>

        {coverImageUrl && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">
              URL retornada pela API
            </span>
            <code className="text-xs bg-white/80 border border-slate-200 rounded-md px-2 py-1.5 break-all text-slate-700">
              {coverImageUrl}
            </code>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
              >
                <Copy className="h-3 w-3" /> Copiar
              </button>
              <a
                href={coverImageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                <ExternalLink className="h-3 w-3" /> Abrir em nova aba
              </a>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="text-xs text-rose-700 leading-relaxed mt-1">
            {errorMessage}
          </p>
        )}

        {status === "missing" && (
          <p className="text-xs text-amber-800 leading-relaxed">
            A resposta da API não trouxe <code>cover_image_url</code>. Isso
            geralmente significa que o backend não recebeu o arquivo. Verifique
            na aba Network se o campo <code>cover_image</code> foi enviado
            como arquivo na requisição.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
