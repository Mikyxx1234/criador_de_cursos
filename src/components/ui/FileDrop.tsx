import { useCallback, useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropProps {
  value?: File | null;
  previewUrl?: string | null;
  onChange: (file: File | null) => void;
  accept?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
}

export function FileDrop({
  value,
  previewUrl,
  onChange,
  accept = "image/*",
  label,
  hint,
  required,
  error,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalPreview, setInternalPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (internalPreview) URL.revokeObjectURL(internalPreview);
      if (file) {
        const url = URL.createObjectURL(file);
        setInternalPreview(url);
      } else {
        setInternalPreview(null);
      }
      onChange(file);
    },
    [internalPreview, onChange]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const preview = internalPreview || previewUrl;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed transition-colors",
          "flex flex-col items-center justify-center text-center p-6 min-h-[180px]",
          isDragging
            ? "border-brand-500 bg-brand-50/50"
            : error
              ? "border-rose-300 bg-rose-50/30"
              : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-slate-100"
        )}
      >
        {preview ? (
          <div className="relative w-full">
            <img
              src={preview}
              alt="Preview"
              className="mx-auto max-h-48 rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFile(null);
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-white shadow border border-slate-200 text-slate-600 hover:text-rose-600"
            >
              <X className="h-4 w-4" />
            </button>
            {value && (
              <p className="text-xs text-slate-500 mt-2 truncate">
                {value.name}
              </p>
            )}
          </div>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">
              Clique ou arraste uma imagem aqui
            </p>
            <p className="text-xs text-slate-500 mt-1">
              PNG, JPG ou WEBP até 5MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
