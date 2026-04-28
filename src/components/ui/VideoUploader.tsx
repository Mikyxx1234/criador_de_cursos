import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  UploadCloud,
  X,
  Film,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";

import {
  uploadVideoToSupabase,
  isSupabaseConfigured,
} from "@/services/supabaseClient";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = "video/mp4,video/webm,video/quicktime,video/x-matroska";
const MAX_SIZE_MB = 500;

interface VideoUploaderProps {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  error?: string;
}

export function VideoUploader({
  value,
  onChange,
  label = "Vídeo",
  hint,
  error,
}: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!configured) {
      toast.error(
        "Supabase não configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env."
      );
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(
        `Arquivo maior que o limite de ${MAX_SIZE_MB} MB. Reduza o tamanho ou ajuste o limite.`
      );
      return;
    }

    setUploading(true);
    setProgress(0);
    setFileName(file.name);
    abortRef.current = new AbortController();

    const uploadPromise = uploadVideoToSupabase(file, {
      onProgress: setProgress,
      signal: abortRef.current.signal,
    });

    toast.promise(uploadPromise, {
      loading: `Enviando "${file.name}"...`,
      success: "Vídeo enviado! URL pronta para salvar.",
      error: (e) => (e instanceof Error ? e.message : "Falha no upload."),
    });

    try {
      const result = await uploadPromise;
      onChange(result.publicUrl);
      setProgress(100);
    } catch (e) {
      console.error("[VideoUploader] erro", e);
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setUploading(false);
    setProgress(0);
    setFileName(null);
  };

  const handleClear = () => {
    onChange("");
    setProgress(0);
    setFileName(null);
  };

  const hasValue = Boolean(value);

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="label">{label}</label>}

      {!configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Supabase não configurado. Defina{" "}
          <code className="font-mono">VITE_SUPABASE_URL</code> e{" "}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> no{" "}
          <code className="font-mono">.env</code> e reinicie o Vite.
        </div>
      )}

      {hasValue && !uploading ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-lg bg-emerald-100">
              <Check className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-900">
                Vídeo disponível
              </p>
              <a
                href={value ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="mt-1 text-xs text-emerald-800 hover:underline break-all inline-flex items-center gap-1"
              >
                {value}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
              {fileName && (
                <p className="text-[11px] text-emerald-700/70 mt-1">
                  <Film className="h-3 w-3 inline mr-1" />
                  {fileName}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-xs font-medium text-emerald-800 hover:text-emerald-900 hover:underline"
                >
                  Trocar vídeo
                </button>
                <span className="text-emerald-300">•</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs font-medium text-rose-700 hover:underline"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : uploading ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-brand-600 animate-spin flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-brand-900 truncate">
                Enviando {fileName}
              </p>
              <div className="mt-2 h-2 rounded-full bg-brand-100 overflow-hidden">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-brand-800/80 mt-1">{progress}%</p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-lg text-brand-700 hover:bg-brand-100"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => configured && inputRef.current?.click()}
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-colors p-6 text-center",
            configured ? "cursor-pointer" : "cursor-not-allowed opacity-70",
            isDragging
              ? "border-brand-500 bg-brand-50/50"
              : error
                ? "border-rose-300 bg-rose-50/30"
                : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-slate-100"
          )}
        >
          <UploadCloud className="h-8 w-8 text-slate-400 mb-2 mx-auto" />
          <p className="text-sm font-medium text-slate-700">
            Clique ou arraste um vídeo para enviar ao Supabase
          </p>
          <p className="text-xs text-slate-500 mt-1">
            MP4, WebM, MOV ou MKV · até {MAX_SIZE_MB} MB · hospedado no bucket
            de vídeos do curso
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          handleFile(file);
          e.target.value = "";
        }}
      />

      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
