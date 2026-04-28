import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Layers,
  Plus,
  ChevronDown,
  ChevronRight,
  Film,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { VideoUploader } from "@/components/ui/VideoUploader";
import { getCourse } from "@/services/courseService";
import {
  createActivity,
  deleteActivity,
  reorderActivities,
} from "@/services/activityService";
import { parseApiError } from "@/services/apiClient";
import type { CourseResponse } from "@/types/course";
import type { ActivityResponse } from "@/types/activity";
import { calcFinalPrice, formatBRL, pctDiscount } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/types/activity";
import { CourseCoverImage } from "@/components/course/CourseCoverImage";
import { cn } from "@/lib/utils";

interface CourseReviewPanelProps {
  courseId: number;
}

interface ModuleGroup {
  /** Atividade article que representa o módulo (pode ser null se houver
   *  atividades órfãs antes do primeiro módulo). */
  article: ActivityResponse | null;
  /** Atividades vinculadas a esse módulo (vídeos, quizzes, etc.) – exclui o
   *  próprio article. */
  children: ActivityResponse[];
}

/**
 * Agrupa as atividades em "módulos": cada `article` é o início de um módulo;
 * tudo que vem depois (até o próximo article ou prova final) pertence a ele.
 * Atividades antes do primeiro article ficam num grupo com article=null.
 * A prova final é separada para ser exibida no fim.
 */
function groupByModule(activities: ActivityResponse[]): {
  modules: ModuleGroup[];
  finalExam: ActivityResponse | null;
} {
  const ordered = [...activities].sort((a, b) => a.order - b.order);
  const finalExam = ordered.find((a) => a.type === "final_exam") ?? null;
  const rest = ordered.filter((a) => a.type !== "final_exam");

  const groups: ModuleGroup[] = [];
  let current: ModuleGroup | null = null;
  for (const a of rest) {
    if (a.type === "article") {
      current = { article: a, children: [] };
      groups.push(current);
    } else {
      if (!current) {
        current = { article: null, children: [] };
        groups.push(current);
      }
      current.children.push(a);
    }
  }
  return { modules: groups, finalExam };
}

export function CourseReviewPanel({ courseId }: CourseReviewPanelProps) {
  const [course, setCourse] = useState<CourseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCourse(courseId);
      setCourse(c);
    } catch (e) {
      const err = parseApiError(e);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const price = Number(course?.price ?? 0);
  const promo = course?.promotional_price
    ? Number(course.promotional_price)
    : null;
  const finalPrice = calcFinalPrice(price, promo);
  const discount = pctDiscount(price, promo);

  const activities = useMemo(
    () =>
      ((course?.activities ?? []) as Array<Record<string, unknown>>).map(
        (a) => a as unknown as ActivityResponse
      ),
    [course]
  );

  const { modules, finalExam } = useMemo(
    () => groupByModule(activities),
    [activities]
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Conferência final do curso</CardTitle>
          <CardDescription>
            Dados carregados diretamente da API via{" "}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              GET /courses/{courseId}
            </code>
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchCourse}
          loading={loading}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Recarregar
        </Button>
      </CardHeader>

      <CardContent>
        {loading && !course ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : course ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  <CourseCoverImage
                    url={course.cover_image_url}
                    alt={course.title}
                    courseId={course.id}
                    title={course.title}
                    category={course.category}
                    categoryLabel={course.category_label}
                    className="h-full w-full"
                  />
                </div>
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <div className="flex items-center flex-wrap gap-2">
                  {course.is_active ? (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Inativo / Rascunho</Badge>
                  )}
                  {course.category_label && (
                    <Badge tone="brand">{course.category_label}</Badge>
                  )}
                  {course.difficulty_level_label && (
                    <Badge tone="violet">
                      {course.difficulty_level_label}
                    </Badge>
                  )}
                  <Badge>{course.workload}h</Badge>
                </div>

                <h2 className="text-xl font-semibold text-slate-900">
                  {course.title}
                </h2>
                {course.short_description && (
                  <p className="text-sm text-slate-600">
                    {course.short_description}
                  </p>
                )}
                {course.description && (
                  <p className="text-sm text-slate-500">{course.description}</p>
                )}

                <div className="mt-2 pt-3 border-t border-slate-200 flex items-baseline gap-2">
                  {promo && promo < price && (
                    <span className="text-sm text-slate-400 line-through">
                      {formatBRL(price)}
                    </span>
                  )}
                  <span className="text-xl font-semibold text-slate-900">
                    {finalPrice === 0 ? "Gratuito" : formatBRL(finalPrice)}
                  </span>
                  {discount > 0 && <Badge tone="success">-{discount}%</Badge>}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Módulos ({modules.length}) · Atividades (
                    {activities.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Você pode adicionar vídeos a cada módulo abaixo.
                </p>
              </div>

              {activities.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
                  Nenhuma atividade cadastrada ainda.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {modules.map((mod, i) => (
                    <ModuleBlock
                      key={mod.article?.id ?? `orphan-${i}`}
                      group={mod}
                      moduleNumber={i + 1}
                      courseId={courseId}
                      activities={activities}
                      onChanged={fetchCourse}
                    />
                  ))}

                  {finalExam && (
                    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-4">
                      <div className="flex items-center gap-2">
                        <Badge tone="warning">Prova Final</Badge>
                        <p className="text-sm font-medium text-amber-900">
                          {finalExam.title}
                        </p>
                        <span className="text-xs text-amber-700/70 ml-auto">
                          ID {finalExam.id}
                          {finalExam.final_exam?.id &&
                            ` · Exam ${finalExam.final_exam.id}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface ModuleBlockProps {
  group: ModuleGroup;
  moduleNumber: number;
  courseId: number;
  activities: ActivityResponse[];
  onChanged: () => Promise<void> | void;
}

function ModuleBlock({
  group,
  moduleNumber,
  courseId,
  activities,
  onChanged,
}: ModuleBlockProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Campos do form de novo vídeo
  const [vTitle, setVTitle] = useState("");
  const [vLink, setVLink] = useState("");
  const [vDescription, setVDescription] = useState("");
  const [vDuration, setVDuration] = useState<string>("");

  const videos = group.children.filter((c) => c.type === "video");
  const others = group.children.filter((c) => c.type !== "video");

  const articleTitle = group.article?.title ?? "(sem artigo associado)";
  const articleId = group.article?.id;

  const resetForm = () => {
    setVTitle("");
    setVLink("");
    setVDescription("");
    setVDuration("");
  };

  const handleSubmitVideo = async () => {
    if (!vTitle.trim()) {
      toast.error("Informe o título do vídeo.");
      return;
    }
    if (!vLink.trim()) {
      toast.error("Faça o upload do vídeo (ou cole uma URL) antes de salvar.");
      return;
    }
    setSubmitting(true);
    try {
      // Cria a atividade no fim e depois reordena para colocá-la logo após
      // o artigo do módulo (ou no fim, se não houver artigo).
      const lastOrder = activities.length
        ? Math.max(...activities.map((a) => a.order))
        : 0;
      const tempOrder = lastOrder + 1;

      const created = await createActivity(courseId, {
        type: "video",
        title: vTitle.trim(),
        order: tempOrder,
        video: {
          link: vLink.trim(),
          description: vDescription.trim() || undefined,
          duration: vDuration ? Number(vDuration) : undefined,
        },
      });

      // Recompõe a ordem desejada: o vídeo deve aparecer dentro do módulo,
      // após o artigo e demais vídeos já existentes (mas antes de quizzes
      // e outros do próximo módulo).
      const finalExam = activities.find((a) => a.type === "final_exam");
      const nonFinal = activities.filter((a) => a.type !== "final_exam");

      const newList: ActivityResponse[] = [];
      let inserted = false;
      for (const a of nonFinal.sort((x, y) => x.order - y.order)) {
        newList.push(a);
        if (!inserted && articleId && a.id === articleId) {
          // Mantém vídeos já existentes no módulo e adiciona o novo no fim
          // dos vídeos atuais.
          const currentVideos = videos.sort((x, y) => x.order - y.order);
          for (const v of currentVideos) {
            const idx = newList.findIndex((x) => x.id === v.id);
            if (idx >= 0) newList.splice(idx, 1);
          }
          for (const v of currentVideos) newList.push(v);
          newList.push(created);
          inserted = true;
        }
      }
      if (!inserted) newList.push(created);

      const reorderPayload = newList.map((a, i) => ({
        id: a.id,
        order: i + 1,
      }));
      if (finalExam) {
        reorderPayload.push({ id: finalExam.id, order: 99 });
      }

      try {
        await reorderActivities(courseId, reorderPayload);
      } catch (re) {
        console.warn("[CourseReviewPanel] falha ao reordenar:", re);
        // Não impede o fluxo — vídeo já foi criado.
      }

      toast.success("Vídeo cadastrado e vinculado ao módulo!");
      resetForm();
      setAdding(false);
      await onChanged();
    } catch (e) {
      const err = parseApiError(e);
      console.error("[CourseReviewPanel] erro ao criar vídeo:", err);
      toast.error(err.message || "Falha ao cadastrar vídeo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVideo = async (videoActivityId: number) => {
    if (!confirm("Remover este vídeo? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      await deleteActivity(videoActivityId);
      toast.success("Vídeo removido.");
      await onChanged();
    } catch (e) {
      const err = parseApiError(e);
      toast.error(err.message || "Falha ao remover.");
    }
  };

  const typeLabel = (t: string) =>
    ACTIVITY_TYPES.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
      >
        <span
          className={cn(
            "h-7 w-7 rounded-md text-xs font-semibold inline-flex items-center justify-center",
            group.article
              ? "bg-brand-100 text-brand-700 border border-brand-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          )}
        >
          {group.article ? moduleNumber : "?"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {articleTitle}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {videos.length} vídeo{videos.length === 1 ? "" : "s"} ·{" "}
            {others.length} outras
            {group.article && ` · ID ${group.article.id}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {videos.length > 0 && (
            <Badge tone="success" className="gap-1">
              <Film className="h-3 w-3" />
              {videos.length}
            </Badge>
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200 bg-slate-50/40 px-3 py-3 space-y-3">
          {/* Vídeos já cadastrados */}
          {videos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {videos.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5"
                >
                  <Film className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-900 truncate">
                      {v.title}
                    </p>
                    {v.video?.link && (
                      <a
                        href={v.video.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-800/80 hover:underline truncate inline-flex items-center gap-1 max-w-full"
                      >
                        <span className="truncate">{v.video.link}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteVideo(v.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50"
                    title="Remover vídeo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Outras atividades do módulo (quiz, embed, etc.) */}
          {others.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {others.map((o) => (
                <li
                  key={o.id}
                  className="text-[11px] inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1"
                >
                  <Badge tone="neutral">{typeLabel(o.type)}</Badge>
                  <span className="text-slate-600 truncate max-w-[200px]">
                    {o.title}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Form de adição */}
          {adding ? (
            <div className="rounded-lg border border-brand-200 bg-white p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Cadastrar novo vídeo neste módulo
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    resetForm();
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
              </div>
              <Input
                label="Título"
                required
                placeholder="Ex.: Aula 1 — Introdução"
                value={vTitle}
                onChange={(e) => setVTitle(e.target.value)}
              />
              <VideoUploader
                label="Arquivo de vídeo"
                value={vLink}
                onChange={setVLink}
                hint="O arquivo é enviado para o Supabase. A URL pública aparece automaticamente abaixo."
              />
              <Input
                label="URL do vídeo"
                placeholder="Preenchida automaticamente pelo upload (ou cole uma URL externa)"
                value={vLink}
                onChange={(e) => setVLink(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Duração (segundos)"
                  type="number"
                  min={0}
                  placeholder="Ex.: 1800 = 30 min"
                  value={vDuration}
                  onChange={(e) => setVDuration(e.target.value)}
                />
                <Textarea
                  label="Descrição (opcional)"
                  rows={2}
                  value={vDescription}
                  onChange={(e) => setVDescription(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  loading={submitting}
                  onClick={handleSubmitVideo}
                  disabled={!vTitle.trim() || !vLink.trim()}
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Cadastrar vídeo
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full rounded-lg border-2 border-dashed border-slate-300 px-3 py-2.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/40 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar vídeo a este módulo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
