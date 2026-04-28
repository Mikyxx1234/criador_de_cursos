import {
  Video,
  FileText,
  Code2,
  BookOpenCheck,
  ListChecks,
  GraduationCap,
  Lock,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { ActivityType } from "@/types/activity";
import { ACTIVITY_TYPES } from "@/types/activity";

const iconMap: Record<ActivityType, React.ReactNode> = {
  video: <Video className="h-5 w-5" />,
  article: <FileText className="h-5 w-5" />,
  embed_content: <Code2 className="h-5 w-5" />,
  support_material: <BookOpenCheck className="h-5 w-5" />,
  quiz: <ListChecks className="h-5 w-5" />,
  final_exam: <GraduationCap className="h-5 w-5" />,
};

interface ActivityTypePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: ActivityType) => void;
  finalExamAlreadyExists: boolean;
}

export function ActivityTypePicker({
  open,
  onClose,
  onPick,
  finalExamAlreadyExists,
}: ActivityTypePickerProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar atividade"
      description="Escolha o tipo de conteúdo que deseja incluir no curso."
      size="lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACTIVITY_TYPES.map((t) => {
          const disabled = t.value === "final_exam" && finalExamAlreadyExists;
          return (
            <button
              key={t.value}
              type="button"
              disabled={disabled}
              onClick={() => {
                onPick(t.value);
                onClose();
              }}
              className={cn(
                "group relative text-left p-4 rounded-xl border bg-white transition-all",
                "flex items-start gap-3",
                disabled
                  ? "opacity-60 cursor-not-allowed border-slate-200"
                  : "border-slate-200 hover:border-brand-400 hover:bg-brand-50/40 hover:shadow-soft"
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-lg inline-flex items-center justify-center shrink-0",
                  disabled
                    ? "bg-slate-100 text-slate-400"
                    : "bg-brand-50 text-brand-700 group-hover:bg-brand-100"
                )}
              >
                {iconMap[t.value]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {t.label}
                  </h4>
                  {t.value === "final_exam" && (
                    <Badge tone="warning">Única por curso</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {t.description}
                </p>
                {disabled && (
                  <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-2">
                    <Lock className="h-3 w-3" />
                    Já existe uma prova final neste curso.
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
