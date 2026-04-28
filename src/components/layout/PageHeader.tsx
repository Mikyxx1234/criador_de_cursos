import { ReactNode } from "react";
import { GraduationCap } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-soft">
      <div
        className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-100/50"
        aria-hidden
      />
      <span
        className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-brand-300/30 blur-3xl page-header-orb"
        aria-hidden
      />
      <span
        className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl page-header-orb-delayed"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.05] page-header-dots"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-200/70 to-transparent"
        aria-hidden
      />

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-6 md:py-7">
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white inline-flex items-center justify-center shadow-lift ring-4 ring-white/60">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="absolute -inset-1 rounded-2xl bg-brand-400/30 blur-md -z-10" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-[1.6rem] font-semibold text-slate-900 tracking-tight leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
