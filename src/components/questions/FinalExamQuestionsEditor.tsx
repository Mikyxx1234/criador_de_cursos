import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, Plus, RefreshCw } from "lucide-react";

import { QuestionsEditor } from "./QuestionsEditor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

import {
  createFinalExamQuestions,
  getFinalExamQuestions,
} from "@/services/questionService";
import { createActivity } from "@/services/activityService";
import { parseApiError } from "@/services/apiClient";
import { uid } from "@/lib/utils";
import type { ActivityResponse } from "@/types/activity";
import type { CorrectOption, QuestionDraft } from "@/types/question";

interface FinalExamQuestionsEditorProps {
  courseId: number;
  activities: ActivityResponse[];
  /** Callback para registrar a nova atividade no builder state. */
  onActivityCreated: (activity: ActivityResponse) => void;
}

export function FinalExamQuestionsEditor({
  courseId,
  activities,
  onActivityCreated,
}: FinalExamQuestionsEditorProps) {
  const finalExam = useMemo(
    () => activities.find((a) => a.type === "final_exam"),
    [activities]
  );
  const finalExamInnerId = finalExam?.final_exam?.id ?? null;

  // Formulário de criação (aparece quando a prova final ainda não existe)
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("Prova Final");
  const [description, setDescription] = useState(
    "Avaliação final do curso. Aproveitamento mínimo: 70%."
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [passingScore, setPassingScore] = useState(70);

  const [loadingKey, setLoadingKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialQuestions, setInitialQuestions] = useState<QuestionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!finalExamInnerId) {
      setInitialQuestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFinalExamQuestions(finalExamInnerId)
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
        console.warn("[FinalExamQuestionsEditor] fetch fail", e);
        setInitialQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [finalExamInnerId, loadingKey]);

  const handleCreateFinalExam = async () => {
    if (creating) return;
    setCreating(true);
    const payload = {
      type: "final_exam" as const,
      title: title.trim() || "Prova Final",
      order: 99,
      final_exam: {
        description: description.trim() || undefined,
        duration_minutes: Number(durationMinutes) || 60,
        max_attempts: Number(maxAttempts) || 3,
        passing_score: Number(passingScore) || 70,
      },
    };
    const p = createActivity(courseId, payload);
    toast.promise(p, {
      loading: "Criando atividade de Prova Final...",
      success: (res) =>
        `Prova Final criada (activity ${res.id}). Agora cadastre as questões.`,
      error: (e) => parseApiError(e).message || "Falha ao criar Prova Final",
    });
    try {
      const created = await p;
      onActivityCreated(created);
    } catch {
      // tratado
    } finally {
      setCreating(false);
    }
  };

  const handleSaveAll = async (questions: QuestionDraft[]) => {
    if (!finalExamInnerId) return;
    setSubmitting(true);
    try {
      const payload = questions.map(({ _localId: _unused, ...rest }) => {
        void _unused;
        return rest;
      });
      const p = createFinalExamQuestions(finalExamInnerId, payload);
      toast.promise(p, {
        loading: "Salvando questões da prova final...",
        success: (res) =>
          `${res.length} questão(ões) salvas na prova final!`,
        error: (e) =>
          parseApiError(e).message || "Falha ao salvar questões",
      });
      await p;
      setLoadingKey((k) => k + 1);
    } catch {
      // tratado
    } finally {
      setSubmitting(false);
    }
  };

  if (!finalExam) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" />
              Prova Final
            </CardTitle>
            <CardDescription>
              Ainda não há uma atividade de Prova Final neste curso. Crie aqui
              mesmo preenchendo os dados abaixo — depois você cadastra as
              questões.
            </CardDescription>
          </div>
          <Badge tone="warning">Pendente</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Prova Final — Social Media"
              />
            </div>
            <div className="md:col-span-2">
              <Textarea
                label="Descrição"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Input
              type="number"
              label="Duração (minutos)"
              min={1}
              value={durationMinutes}
              onChange={(e) =>
                setDurationMinutes(Number(e.target.value) || 60)
              }
            />
            <Input
              type="number"
              label="Tentativas máximas"
              min={1}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value) || 3)}
            />
            <Input
              type="number"
              label="Aproveitamento mínimo (%)"
              min={0}
              max={100}
              value={passingScore}
              onChange={(e) => setPassingScore(Number(e.target.value) || 70)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleCreateFinalExam}
              loading={creating}
              icon={<Plus className="h-4 w-4" />}
            >
              Criar Prova Final
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="text-xs text-slate-500">
          Prova Final:{" "}
          <span className="font-medium text-slate-800">{finalExam.title}</span>{" "}
          · Activity ID {finalExam.id} · Exam interno ID{" "}
          {finalExamInnerId ?? "—"}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLoadingKey((k) => k + 1)}
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          disabled={loading || !finalExamInnerId}
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
          key={`${finalExam.id}-${loadingKey}`}
          title="Questões da Prova Final"
          description="Ao salvar, as questões são enviadas em lote para a API da prova final."
          activityId={finalExamInnerId}
          disabledReason="A Prova Final não possui um ID interno retornado pela API."
          onSaveAll={handleSaveAll}
          submitting={submitting}
          initialQuestions={
            initialQuestions.length ? initialQuestions : undefined
          }
        />
      )}
    </div>
  );
}
