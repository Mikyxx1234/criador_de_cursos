import { SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      error,
      label,
      hint,
      required,
      id,
      options,
      placeholder,
      ...rest
    },
    ref
  ) => {
    const inputId = id || rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={inputId}
            ref={ref}
            className={cn(
              "appearance-none h-10 pl-3.5 pr-10 w-full rounded-xl border bg-white text-sm text-slate-900",
              "transition-colors",
              error
                ? "border-rose-400 focus:border-rose-500"
                : "border-slate-300 hover:border-slate-400 focus:border-brand-500",
              className
            )}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {hint && !error && <span className="hint">{hint}</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
    );
  }
);

Select.displayName = "Select";
