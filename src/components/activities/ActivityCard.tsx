import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Video,
  FileText,
  Code2,
  BookOpenCheck,
  ListChecks,
  GraduationCap,
  Pencil,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ActivityResponse, ActivityType } from "@/types/activity";

const iconMap: Record<ActivityType, React.ReactNode> = {
  video: <Video className="h-4 w-4" />,
  article: <FileText className="h-4 w-4" />,
  embed_content: <Code2 className="h-4 w-4" />,
  support_material: <BookOpenCheck className="h-4 w-4" />,
  quiz: <ListChecks className="h-4 w-4" />,
  final_exam: <GraduationCap className="h-4 w-4" />,
};

const toneMap: Record<
  ActivityType,
  "brand" | "emerald" | "amber" | "violet" | "sky" | "warning"
> = {
  video: "brand",
  article: "emerald",
  embed_content: "sky",
  support_material: "violet",
  quiz: "amber",
  final_exam: "warning",
};

const labelMap: Record<ActivityType, string> = {
  video: "Vídeo",
  article: "Artigo",
  embed_content: "Embed",
  support_material: "Material",
  quiz: "Quiz",
  final_exam: "Prova Final",
};

interface ActivityCardProps {
  activity: ActivityResponse;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onEditQuestions?: () => void;
  children?: React.ReactNode;
}

export function ActivityCard({
  activity,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onDelete,
  onEditQuestions,
  children,
}: ActivityCardProps) {
  const [open, setOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: activity.id,
    disabled: activity.type === "final_exam",
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isFinal = activity.type === "final_exam";

  const canMoveUp = !isFinal && index > 0;
  const canMoveDown = !isFinal && index < total - 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "card overflow-hidden",
        isDragging && "opacity-60 ring-2 ring-brand-400 shadow-lift"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/70 bg-white">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={isFinal}
          className={cn(
            "p-1.5 rounded-md text-slate-400",
            isFinal
              ? "cursor-not-allowed"
              : "hover:bg-slate-100 hover:text-slate-600 cursor-grab active:cursor-grabbing"
          )}
          title={isFinal ? "Prova final é sempre a última" : "Arraste para reordenar"}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="h-8 w-8 rounded-lg bg-slate-100 inline-flex items-center justify-center text-slate-700 shrink-0">
          {iconMap[activity.type]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500">
              #{activity.order}
            </span>
            <h4 className="text-sm font-semibold text-slate-900 truncate">
              {activity.title}
            </h4>
            <Badge tone={toneMap[activity.type]}>{labelMap[activity.type]}</Badge>
            {isFinal && <Badge tone="warning">Sempre por último</Badge>}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            ID atividade: {activity.id}
            {activity.quiz?.id && ` · Quiz ID ${activity.quiz.id}`}
            {activity.final_exam?.id && ` · Exam ID ${activity.final_exam.id}`}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(activity.type === "quiz" || activity.type === "final_exam") &&
            onEditQuestions && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEditQuestions}
                icon={<Pencil className="h-3.5 w-3.5" />}
              >
                Questões
              </Button>
            )}

          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mover para cima"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mover para baixo"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Remover atividade"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title={open ? "Recolher" : "Expandir"}
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {open && <div className="bg-slate-50/60 px-5 py-4">{children}</div>}
    </div>
  );
}
