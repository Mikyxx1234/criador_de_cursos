import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface WelcomeSplashProps {
  onDone: () => void;
  durationMs?: number;
}

export function WelcomeSplash({
  onDone,
  durationMs = 1600,
}: WelcomeSplashProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitDelay = Math.max(0, durationMs - 500);
    const exitT = window.setTimeout(() => setExiting(true), exitDelay);
    const doneT = window.setTimeout(onDone, durationMs);
    return () => {
      window.clearTimeout(exitT);
      window.clearTimeout(doneT);
    };
  }, [durationMs, onDone]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center overflow-hidden",
        "bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900",
        "transition-opacity duration-500 ease-out",
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
      aria-hidden={exiting}
    >
      {/* Halos animados ao fundo */}
      <span
        className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl splash-float"
        aria-hidden
      />
      <span
        className="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-brand-300/20 blur-3xl splash-float-delayed"
        aria-hidden
      />

      <div
        className={cn(
          "relative flex flex-col items-center gap-7 splash-pop",
          exiting && "splash-pop-out"
        )}
      >
        <div className="relative h-28 w-28">
          <span className="absolute inset-0 rounded-full bg-white/30 splash-ring" />
          <span className="absolute inset-2 rounded-full bg-white/15 splash-ring-delayed" />
          <div className="relative h-28 w-28 rounded-full bg-white shadow-2xl flex items-center justify-center">
            <svg
              className="h-14 w-14 text-brand-600 splash-check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-white text-3xl font-semibold tracking-tight splash-fade-up">
            Acesso liberado
          </h2>
          <p className="text-white/80 text-sm mt-2 splash-fade-up-delayed">
            Carregando seu painel...
          </p>
        </div>

        <div className="splash-bar mt-2">
          <span />
        </div>
      </div>
    </div>
  );
}
