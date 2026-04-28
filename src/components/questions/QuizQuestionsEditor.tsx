import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ListChecks, RefreshCw, HelpCircle } from "lucide-react";

import { QuestionsEditor } from "./QuestionsEditor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn, uid } from "@/lib/utils";

import {
  createQuizQuestions,
  getQuizQuestions,
} from "@/services/questionService";
import { parseApiError } from "@/services/apiClient";
import type { ActivityResponse } from "@/types/activity";
import type { CorrectOption, QuestionDraft } from "@/types/question";

interface QuizQuestionsEditorProps {
  /** Todas as atividades do curso — vamos filtrar só as de tipo quiz. */
  activities: ActivityResponse[];
  /** Último quiz criado pelo builder, usado como seleção inicial. */
  defaultQuizActivityId?: number | null;
}

export function QuizQuestionsEditor({
  activities,
  defaultQuizActivityId = null,
}: QuizQuestionsEditorProps) {
  const quizzes = useMemo(
    () => activities.filter((a) => a.type === "quiz"),
    [activities]
  );

  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(
    () => defaultQuizActivityId ?? quizzes[0]?.id ?? null
  );

  useEffect(() => {
    if (selectedActivityId && quizzes.some((q) => q.id === selectedActivityId))
      return;
    setSelectedActivityId(defaultQuizActivityId ?? quizzes[0]?.id ?? null);
  }, [quizzes, defaultQuizActivityId, selectedActivityId]);

  const selectedActivity = quizzes.find((q) => q.id === selectedActivityId);
  const quizInnerId = selectedActivity?.quiz?.id ?? null;

  const [loadingKey, setLoadingKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialQuestions, setInitialQuestions] = useState<QuestionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!quizInnerId) {
      setInitialQuestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getQuizQuestions(quizInnerId)
      .then((list) => {
        if (cancelled) return;
        const drafts: QuestionDraft[] = list.map((q, i) => ({
          _localId: uid(),
          statement: q.statement,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: (q.correct_option?.toLowerCase() ||
            "a") as CorrectOption,
          order: q.order ?? i + 1,
        }));
        setInitialQuestions(drafts);
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn("[QuizQuestionsEditor] fetch fail", e);
        setInitialQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quizInnerId, loadingKey]);

  const handleSaveAll = async (questions: QuestionDraft[]) => {
    if (!quizInnerId) return;
    setSubmitting(true);
    try {
      const payload = questions.map(({ _localId: _unused, ...rest }) => {
        void _unused;
        return rest;
      });
      const p = createQuizQuestions(quizInnerId, payload);
      toast.promise(p, {
        loading: "Salvando questões do quiz...",
        success: (res) =>
          `${res.length} questão(ões) salva(s) em "${selectedActivity?.title}"!`,
        error: (e) =>
          parseApiError(e).message || "Falha ao salvar questões",
      });
      await p;
      setLoadingKey((k) => k + 1);
    } catch {
      // tratado pelo toast
    } finally {
      setSubmitting(false);
    }
  };

  if (quizzes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-slate-500" />
            Questões do Quiz
          </CardTitle>
          <CardDescription>
            Cadastre as questões de múltipla escolha (4 alternativas, 1
            correta). Cada atividade do tipo Quiz no curso tem suas próprias
            questões.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
            <HelpCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">
                Nenhuma atividade de quiz encontrada neste curso
              </p>
              <p className="text-xs mt-1 text-amber-800">
                Volte para a etapa <strong>2 · Atividades</strong> e adicione
                uma atividade do tipo <strong>Quiz</strong>. Depois volte aqui
                para cadastrar as questões.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-slate-500" />
              Questões do Quiz
            </CardTitle>
            <CardDescription>
              {quizzes.length} atividade(s) de quiz neste curso. Selecione qual
              editar abaixo.
            </CardDescription>
          </div>
          <Badge tone="sky">{quizzes.length} quiz(zes)</Badge>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {quizzes.map((q) => {
              const active = q.id === selectedActivityId;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedActivityId(q.id)}
                  className={cn(
                    "text-xs px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 max-w-full",
                    active
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                  )}
                  title={q.title}
                >
                  <span
                    className={cn(
                      "h-5 min-w-[20px] px-1 rounded text-[10px] font-semibold inline-flex items-center justify-center",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    #{q.order}
                  </span>
                  <span className="truncate max-w-[220px]">{q.title}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedActivity && (
        <>
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="text-xs text-slate-500">
              Editando:{" "}
              <span className="font-medium text-slate-800">
                {selectedActivity.title}
              </span>{" "}
              · Activity ID {selectedActivity.id} · Quiz interno ID{" "}
              {quizInnerId ?? "—"}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLoadingKey((k) => k + 1)}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              disabled={loading || !quizInnerId}
            >
              Recarregar
            </Button>
          </div>

          {loading ? (
            <div className="card p-8 flex items-center justify-center gap-3 text-slate-500">
              <Spinner className="h-5 w-5" />
              <span className="text-sm">Carregando questões existentes...</span>
            </div>
          ) : (
            <QuestionsEditor
              key={`${selectedActivity.id}-${loadingKey}`}
              title="Questões deste quiz"
              description="Ao salvar, as questões cadastradas aqui substituem/anexam as anteriores, conforme o backend."
              activityId={quizInnerId}
              disabledReason="Este quiz não possui um ID interno retornado pela API."
              onSaveAll={handleSaveAll}
              submitting={submitting}
              initialQuestions={
                initialQuestions.length ? initialQuestions : undefined
              }
            />
          )}
        </>
      )}
    </div>
  );
}
