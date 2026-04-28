import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  hint?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, hint, required, id, rows = 4, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          className={cn(
            "px-3.5 py-2.5 rounded-xl border bg-white text-sm text-slate-900 placeholder:text-slate-400 resize-y",
            "transition-colors",
            error
              ? "border-rose-400 focus:border-rose-500"
              : "border-slate-300 hover:border-slate-400 focus:border-brand-500",
            className
          )}
          {...rest}
        />
        {hint && !error && <span className="hint">{hint}</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
