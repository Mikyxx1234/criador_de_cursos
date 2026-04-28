import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Code2,
  Eye,
  KeyRound,
  Power,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Stepper } from "@/components/layout/Stepper";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { CourseMainForm } from "@/components/course/CourseMainForm";
import { CourseSidebarPreview } from "@/components/course/CourseSidebarPreview";
import { ActivitiesBuilder } from "@/components/activities/ActivitiesBuilder";
import { QuizQuestionsEditor } from "@/components/questions/QuizQuestionsEditor";
import { FinalExamQuestionsEditor } from "@/components/questions/FinalExamQuestionsEditor";
import { CourseReviewPanel } from "@/components/review/CourseReviewPanel";
import { JsonPreviewModal } from "@/components/review/JsonPreviewModal";
import { RenewTokenModal } from "@/components/auth/RenewTokenModal";

import { useCourseBuilder, type BuilderStep } from "@/hooks/useCourseBuilder";
import { getApiConfig } from "@/services/apiClient";
import { getCourse, updateCourse } from "@/services/courseService";
import { parseApiError } from "@/services/apiClient";

interface CourseCreatorPageProps {
  editingCourseId?: number | null;
  onBackToList?: () => void;
}

export function CourseCreatorPage({
  editingCourseId = null,
  onBackToList,
}: CourseCreatorPageProps = {}) {
  const {
    state,
    setCourse,
    updateCourse: updateCourseState,
    setCurrentStep,
    addActivity,
    removeActivity,
    reorderLocalActivities,
    reset,
    loadCourseIntoBuilder,
    hasFinalExam,
  } = useCourseBuilder();

  const quizCount = state.activities.filter((a) => a.type === "quiz").length;

  const [loadingCourse, setLoadingCourse] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rawApiResponse, setRawApiResponse] = useState<unknown>(null);
  const [showRawDebug, setShowRawDebug] = useState(false);

  useEffect(() => {
    if (!editingCourseId) return;

    let cancelled = false;
    setLoadingCourse(true);
    setLoadError(null);
    getCourse(editingCourseId)
      .then((course) => {
        if (cancelled) return;
        setRawApiResponse(course);
        loadCourseIntoBuilder(course, 1);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(parseApiError(e).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingCourse(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editingCourseId, loadCourseIntoBuilder]);

  const [jsonOpen, setJsonOpen] = useState(false);
  const [renewTokenOpen, setRenewTokenOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedQuizActivityId, setSelectedQuizActivityId] = useState<
    number | null
  >(null);

  const { baseUrl, hasToken } = getApiConfig();

  const steps = useMemo(
    () => [
      {
        id: 1,
        label: "Dados do curso",
        description: state.course
          ? `ID ${state.course.id}`
          : "Cadastro inicial",
        done: !!state.course,
      },
      {
        id: 2,
        label: "Atividades",
        description: `${state.activities.length} item(ns)`,
        disabled: !state.course,
        done: state.activities.length > 0,
      },
      {
        id: 3,
        label: "Quiz",
        description:
          quizCount > 0
            ? `${quizCount} quiz(zes)`
            : "Opcional",
        disabled: !state.course,
        done: quizCount > 0,
      },
      {
        id: 4,
        label: "Prova final",
        description: hasFinalExam
          ? `Exam ID ${state.finalExamActivityId ?? "—"}`
          : "Obrigatória",
        disabled: !state.course,
        done: hasFinalExam,
      },
      {
        id: 5,
        label: "Revisão",
        description: "Conferência final",
        disabled: !state.course,
      },
    ],
    [state, quizCount, hasFinalExam]
  );

  const jsonStructure = useMemo(
    () => ({
      course: state.course,
      activities: state.activities,
      quizActivityId: state.quizActivityId,
      finalExamActivityId: state.finalExamActivityId,
    }),
    [state]
  );

  const handlePublishToggle = async () => {
    if (!state.course) return;
    setPublishing(true);
    try {
      const desired = !state.course.is_active;
      const p = updateCourse(state.course.id, { is_active: desired } as never);
      toast.promise(p, {
        loading: desired ? "Ativando curso..." : "Desativando curso...",
        success: desired ? "Curso ativado!" : "Curso desativado.",
        error: (e) => parseApiError(e).message || "Falha ao alterar status",
      });
      const updated = await p;
      updateCourseState(updated);
    } catch {
      // tratado
    } finally {
      setPublishing(false);
    }
  };

  const handleReset = () => {
    if (!confirm("Limpar todos os dados do builder local? (não apaga nada na API)")) return;
    reset();
    toast.success("Builder limpo. Você pode começar um novo curso.");
  };

  const isEditMode = Boolean(editingCourseId);

  if (loadingCourse) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Spinner className="h-6 w-6" />
          <p className="text-sm">Carregando curso #{editingCourseId}...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <p className="text-base font-semibold text-rose-700">
            Não consegui carregar o curso
          </p>
          <p className="text-sm text-slate-600">{loadError}</p>
          {onBackToList && (
            <Button
              size="sm"
              variant="outline"
              onClick={onBackToList}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Voltar para a lista
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <PageHeader
          title={isEditMode ? "Editar curso" : "Criação de Cursos"}
          subtitle={
            isEditMode
              ? "Atualize os dados do curso, reorganize atividades, ajuste quiz e prova final."
              : "Cadastre o curso, adicione atividades (vídeos, artigos, embeds, material), monte o quiz e a prova final, reordene a estrutura e confira o resultado."
          }
          actions={
            <>
              {onBackToList && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBackToList}
                  icon={<ArrowLeft className="h-4 w-4" />}
                >
                  Voltar para lista
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenewTokenOpen(true)}
                icon={<KeyRound className="h-4 w-4" />}
                title="Renovar o token de acesso à API"
              >
                Renovar token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setJsonOpen(true)}
                icon={<Code2 className="h-4 w-4" />}
              >
                Ver JSON
              </Button>
              {state.course && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(5)}
                  icon={<Eye className="h-4 w-4" />}
                >
                  Conferir curso
                </Button>
              )}
              {state.course && (
                <Button
                  variant={state.course.is_active ? "outline" : "primary"}
                  size="sm"
                  onClick={handlePublishToggle}
                  loading={publishing}
                  icon={<Power className="h-4 w-4" />}
                >
                  {state.course.is_active ? "Desativar" : "Publicar / Ativar"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                icon={<RotateCcw className="h-4 w-4" />}
              >
                Limpar builder
              </Button>
            </>
          }
        />

        {!hasToken && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Nenhum <code>VITE_API_TOKEN</code> configurado em{" "}
            <code>.env</code>. As chamadas autenticadas retornarão 401.
          </div>
        )}

        <div className="mt-6">
          <Stepper
            steps={steps}
            current={state.currentStep}
            onStepClick={(id) => setCurrentStep(id as BuilderStep)}
          />
        </div>

        {isEditMode && rawApiResponse !== null && (
          <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3 text-xs text-amber-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <strong>Debug · Resposta bruta da API</strong> ·{" "}
                {state.activities.length} atividade(s) após normalização ·{" "}
                Tipos detectados:{" "}
                {state.activities
                  .map((a) => a.type)
                  .reduce<Record<string, number>>((acc, t) => {
                    acc[t] = (acc[t] ?? 0) + 1;
                    return acc;
                  }, {}) &&
                  Object.entries(
                    state.activities
                      .map((a) => a.type)
                      .reduce<Record<string, number>>((acc, t) => {
                        acc[t] = (acc[t] ?? 0) + 1;
                        return acc;
                      }, {})
                  )
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRawDebug((s) => !s)}
              >
                {showRawDebug ? "Ocultar" : "Ver JSON bruto da API"}
              </Button>
            </div>
            {showRawDebug && (
              <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                {JSON.stringify(
                  {
                    course_id:
                      (rawApiResponse as { id?: number })?.id ?? null,
                    sample_activities_RAW: (
                      (rawApiResponse as { __rawActivities?: unknown[] })
                        ?.__rawActivities ?? []
                    ).slice(0, 3),
                    sample_activities_NORMALIZED: (
                      (rawApiResponse as { activities?: unknown[] })
                        ?.activities ?? []
                    ).slice(0, 3),
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr,360px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            {state.currentStep === 1 && (
              <CourseMainForm
                existingCourse={state.course}
                onCreated={(c) => {
                  setCourse(c);
                  setCurrentStep(2);
                }}
                onUpdated={(c) => updateCourseState(c)}
              />
            )}

            {state.currentStep === 2 && state.course && (
              <ActivitiesBuilder
                courseId={state.course.id}
                activities={state.activities}
                hasFinalExam={hasFinalExam}
                onAdd={addActivity}
                onRemove={removeActivity}
                onReorderLocal={reorderLocalActivities}
                onNavigateToQuestions={(type, activityId) => {
                  if (type === "quiz") {
                    setSelectedQuizActivityId(activityId);
                    setCurrentStep(3);
                  } else {
                    setCurrentStep(4);
                  }
                }}
              />
            )}

            {state.currentStep === 3 && (
              <QuizQuestionsEditor
                activities={state.activities}
                defaultQuizActivityId={
                  selectedQuizActivityId ?? state.quizActivityId
                }
              />
            )}

            {state.currentStep === 4 && state.course && (
              <FinalExamQuestionsEditor
                courseId={state.course.id}
                activities={state.activities}
                onActivityCreated={addActivity}
              />
            )}

            {state.currentStep === 5 && state.course && (
              <CourseReviewPanel courseId={state.course.id} />
            )}

            {!state.course && state.currentStep !== 1 && (
              <div className="card p-6 text-center">
                <BookOpen className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  Crie o curso primeiro
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Volte para a etapa 1 para cadastrar os dados principais.
                </p>
                <div className="mt-4">
                  <Button
                    size="sm"
                    onClick={() => setCurrentStep(1)}
                    icon={<Save className="h-4 w-4" />}
                  >
                    Ir para Etapa 1
                  </Button>
                </div>
              </div>
            )}

            <footer className="text-[11px] text-slate-400 text-center pt-4">
              API base: <code>{baseUrl}</code>
            </footer>
          </div>

          <aside className="xl:sticky xl:top-6">
            <CourseSidebarPreview
              course={state.course}
              activities={state.activities}
              quizActivityId={state.quizActivityId}
              finalExamActivityId={state.finalExamActivityId}
            />
          </aside>
        </div>
      </div>

      <JsonPreviewModal
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        data={jsonStructure}
        title="Estrutura do curso (JSON)"
      />

      <RenewTokenModal
        open={renewTokenOpen}
        onClose={() => setRenewTokenOpen(false)}
      />
    </div>
  );
}
