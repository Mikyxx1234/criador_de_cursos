import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  id: number;
  label: string;
  description?: string;
  disabled?: boolean;
  done?: boolean;
}

interface StepperProps {
  steps: StepperStep[];
  current: number;
  onStepClick?: (id: number) => void;
}

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <nav className="card px-4 py-3">
      <ol className="flex items-center gap-2 md:gap-4 overflow-x-auto">
        {steps.map((s, idx) => {
          const isCurrent = current === s.id;
          const isPast = s.done || current > s.id;
          return (
            <li key={s.id} className="flex items-center gap-2 md:gap-4 shrink-0">
              <button
                type="button"
                disabled={s.disabled}
                onClick={() => !s.disabled && onStepClick?.(s.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                  isCurrent
                    ? "bg-brand-50 border border-brand-200"
                    : "hover:bg-slate-50 border border-transparent",
                  s.disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "h-8 w-8 rounded-full inline-flex items-center justify-center text-sm font-semibold shrink-0",
                    isPast
                      ? "bg-emerald-600 text-white"
                      : isCurrent
                        ? "bg-brand-600 text-white"
                        : "bg-slate-200 text-slate-600"
                  )}
                >
                  {isPast ? <Check className="h-4 w-4" /> : s.id}
                </span>
                <div className="flex flex-col leading-tight">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isCurrent ? "text-brand-700" : "text-slate-800"
                    )}
                  >
                    {s.label}
                  </span>
                  {s.description && (
                    <span className="text-[11px] text-slate-500">
                      {s.description}
                    </span>
                  )}
                </div>
              </button>
              {idx < steps.length - 1 && (
                <div className="h-px w-6 md:w-10 bg-slate-200" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
