import { useMemo, useState } from "react";
import { Plus, Info, Save, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ActivityCard } from "./ActivityCard";
import { ActivityTypePicker } from "./ActivityTypePicker";
import { VideoForm } from "./forms/VideoForm";
import { ArticleForm } from "./forms/ArticleForm";
import { EmbedForm } from "./forms/EmbedForm";
import { SupportMaterialForm } from "./forms/SupportMaterialForm";
import { QuizForm } from "./forms/QuizForm";
import { FinalExamForm } from "./forms/FinalExamForm";

import {
  createActivity,
  deleteActivity,
  reorderActivities,
} from "@/services/activityService";
import { parseApiError } from "@/services/apiClient";
import type {
  ActivityCreateDTO,
  ActivityResponse,
  ActivityType,
} from "@/types/activity";

interface ActivitiesBuilderProps {
  courseId: number;
  activities: ActivityResponse[];
  hasFinalExam: boolean;
  onAdd: (a: ActivityResponse) => void;
  onRemove: (id: number) => void;
  onReorderLocal: (list: ActivityResponse[]) => void;
  onNavigateToQuestions: (type: "quiz" | "final_exam", activityId: number) => void;
}

export function ActivitiesBuilder({
  courseId,
  activities,
  hasFinalExam,
  onAdd,
  onRemove,
  onReorderLocal,
  onNavigateToQuestions,
}: ActivitiesBuilderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const sortedActivities = useMemo(() => {
    const nonFinal = activities.filter((a) => a.type !== "final_exam");
    const final = activities.find((a) => a.type === "final_exam");
    return final ? [...nonFinal, final] : nonFinal;
  }, [activities]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleCreate = async (dto: ActivityCreateDTO) => {
    setSubmitting(true);
    try {
      const nextOrder =
        dto.type === "final_exam" ? 99 : activities.length + 1;
      const payload = { ...dto, order: nextOrder };
      console.log("[ActivitiesBuilder] Enviando atividade:", payload);
      const promise = createActivity(courseId, payload);
      toast.promise(promise, {
        loading: "Criando atividade...",
        success: "Atividade criada com sucesso!",
        error: (e) => {
          const parsed = parseApiError(e);
          console.error("[ActivitiesBuilder] Erro ao criar atividade:", parsed);
          if (parsed.errors) {
            const fieldList = Object.entries(parsed.errors)
              .map(([f, msgs]) => `• ${f}: ${(msgs as string[]).join(", ")}`)
              .join("\n");
            return `${parsed.message}\n${fieldList}`;
          }
          return parsed.message || "Falha ao criar atividade";
        },
      });
      const created = await promise;
      onAdd(created);
      setSelectedType(null);

      if (created.type === "quiz" && created.quiz?.id) {
        toast.success(`Quiz ID ${created.quiz.id} salvo. Agora adicione questões.`);
      }
      if (created.type === "final_exam" && created.final_exam?.id) {
        toast.success(
          `Prova final ID ${created.final_exam.id} salva. Agora adicione questões.`
        );
      }
    } catch {
      // erro tratado pelo toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover esta atividade? Esta ação não pode ser desfeita.")) return;
    try {
      const p = deleteActivity(id);
      toast.promise(p, {
        loading: "Removendo atividade...",
        success: "Atividade removida.",
        error: (e) => parseApiError(e).message || "Falha ao remover",
      });
      await p;
      onRemove(id);
    } catch {
      // tratado
    }
  };

  const moveByDelta = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sortedActivities.length) return;
    if (sortedActivities[target].type === "final_exam") return;
    if (sortedActivities[index].type === "final_exam") return;
    const next = arrayMove(sortedActivities, index, target);
    onReorderLocal(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedActivities.findIndex((a) => a.id === active.id);
    const newIndex = sortedActivities.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    if (sortedActivities[newIndex].type === "final_exam") return;
    const reordered = arrayMove(sortedActivities, oldIndex, newIndex);
    onReorderLocal(reordered);
  };

  const persistReorder = async () => {
    if (!activities.length) return;
    setReordering(true);
    try {
      const payload = sortedActivities.map((a, i) => ({
        id: a.id,
        order: a.type === "final_exam" ? 99 : i + 1,
      }));
      const p = reorderActivities(courseId, payload);
      toast.promise(p, {
        loading: "Salvando nova ordem...",
        success: "Ordem das atividades atualizada!",
        error: (e) => parseApiError(e).message || "Falha ao reordenar",
      });
      await p;
    } catch {
      // tratado
    } finally {
      setReordering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-500" />
            Estrutura de atividades
          </CardTitle>
          <CardDescription>
            Adicione vídeos, artigos, embeds, materiais de apoio, quiz e a prova
            final. Você pode reordenar arrastando ou usando as setas.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {activities.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={persistReorder}
              loading={reordering}
              icon={<Save className="h-3.5 w-3.5" />}
            >
              Salvar ordem
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setPickerOpen(true)}
            icon={<Plus className="h-4 w-4" />}
          >
            Adicionar atividade
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {selectedType && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-brand-800">
                Nova atividade:{" "}
                {selectedType.replace("_", " ").toUpperCase()}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Cancelar
              </button>
            </div>
            {selectedType === "video" && (
              <VideoForm onSubmit={handleCreate} submitting={submitting} />
            )}
            {selectedType === "article" && (
              <ArticleForm onSubmit={handleCreate} submitting={submitting} />
            )}
            {selectedType === "embed_content" && (
              <EmbedForm onSubmit={handleCreate} submitting={submitting} />
            )}
            {selectedType === "support_material" && (
              <SupportMaterialForm
                onSubmit={handleCreate}
                submitting={submitting}
              />
            )}
            {selectedType === "quiz" && (
              <QuizForm onSubmit={handleCreate} submitting={submitting} />
            )}
            {selectedType === "final_exam" && (
              <FinalExamForm onSubmit={handleCreate} submitting={submitting} />
            )}
          </div>
        )}

        {activities.length === 0 && !selectedType && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Info className="h-6 w-6 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">
              Nenhuma atividade ainda
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Comece adicionando vídeos, artigos, quiz e uma prova final.
            </p>
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => setPickerOpen(true)}
                icon={<Plus className="h-4 w-4" />}
              >
                Adicionar primeira atividade
              </Button>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedActivities.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2.5">
              {sortedActivities.map((a, i) => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  index={i}
                  total={sortedActivities.length}
                  onMoveUp={() => moveByDelta(i, -1)}
                  onMoveDown={() => moveByDelta(i, 1)}
                  onDelete={() => handleDelete(a.id)}
                  onEditQuestions={
                    a.type === "quiz"
                      ? () => onNavigateToQuestions("quiz", a.id)
                      : a.type === "final_exam"
                        ? () => onNavigateToQuestions("final_exam", a.id)
                        : undefined
                  }
                >
                  <ActivityDetails activity={a} />
                </ActivityCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>

      <ActivityTypePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(t) => setSelectedType(t)}
        finalExamAlreadyExists={hasFinalExam}
      />
    </Card>
  );
}

function ActivityDetails({ activity }: { activity: ActivityResponse }) {
  return (
    <div className="text-sm text-slate-600 space-y-2">
      {activity.video && (
        <>
          <DetailRow label="Link" value={activity.video.link} />
          <DetailRow
            label="Duração"
            value={`${activity.video.duration ?? 0}s`}
          />
          {activity.video.description && (
            <DetailRow label="Descrição" value={activity.video.description} />
          )}
        </>
      )}
      {activity.article && (
        <>
          {activity.article.description && (
            <DetailRow label="Descrição" value={activity.article.description} />
          )}
          <DetailRow
            label="Conteúdo"
            value={`${activity.article.content_richtext?.slice(0, 120)}${
              (activity.article.content_richtext?.length ?? 0) > 120 ? "..." : ""
            }`}
          />
        </>
      )}
      {activity.embed_content && (
        <>
          {activity.embed_content.description && (
            <DetailRow
              label="Descrição"
              value={activity.embed_content.description}
            />
          )}
          <DetailRow
            label="Embed"
            value={`${activity.embed_content.embed_code?.slice(0, 100)}...`}
          />
        </>
      )}
      {activity.support_material && (
        <>
          {activity.support_material.description && (
            <DetailRow
              label="Descrição"
              value={activity.support_material.description}
            />
          )}
        </>
      )}
      {activity.quiz && (
        <>
          <DetailRow
            label="Duração"
            value={`${activity.quiz.duration_minutes ?? 0} min`}
          />
          <DetailRow
            label="Nota de corte"
            value={`${activity.quiz.passing_score ?? 0}%`}
          />
          <DetailRow
            label="Quiz ID (para questões)"
            value={String(activity.quiz.id)}
          />
        </>
      )}
      {activity.final_exam && (
        <>
          <DetailRow
            label="Tentativas máx."
            value={String(activity.final_exam.max_attempts)}
          />
          <DetailRow
            label="Duração"
            value={`${activity.final_exam.duration_minutes} min`}
          />
          <DetailRow
            label="Nota de corte"
            value={`${activity.final_exam.passing_score ?? 70}%`}
          />
          <DetailRow
            label="Exam ID (para questões)"
            value={String(activity.final_exam.id)}
          />
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs font-medium text-slate-500 shrink-0 w-32">
        {label}
      </span>
      <span className="text-xs text-slate-700 break-all">{value}</span>
    </div>
  );
}
