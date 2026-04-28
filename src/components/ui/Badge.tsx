import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "violet"
  | "amber"
  | "emerald"
  | "sky";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200",
  brand: "bg-brand-50 text-brand-700 border-brand-100",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
  danger: "bg-rose-50 text-rose-700 border-rose-100",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
  amber: "bg-amber-50 text-amber-800 border-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sky: "bg-sky-50 text-sky-700 border-sky-100",
};

export function Badge({
  className,
  tone = "default",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
        toneClasses[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
