import { useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { cn, uid } from "@/lib/utils";
import type { CorrectOption, QuestionDraft } from "@/types/question";

interface QuestionsEditorProps {
  title: string;
  description: string;
  activityId: number | null;
  disabledReason?: string;
  onSaveAll: (questions: QuestionDraft[]) => Promise<void>;
  submitting: boolean;
  initialCount?: number;
  /**
   * Quando fornecido, prepopula o editor com essas questões (edição de quiz
   * existente). Se vazio/undefined, mostra `initialCount` questões em branco.
   */
  initialQuestions?: QuestionDraft[];
}

function emptyQuestion(order: number): QuestionDraft {
  return {
    _localId: uid(),
    statement: "",
    option_a: "",
    option_b: "",
    option_c: "",
    option_d: "",
    correct_option: "a",
    order,
  };
}

export function QuestionsEditor({
  title,
  description,
  activityId,
  disabledReason,
  onSaveAll,
  submitting,
  initialCount = 1,
  initialQuestions,
}: QuestionsEditorProps) {
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    initialQuestions && initialQuestions.length
      ? initialQuestions
      : Array.from({ length: initialCount }, (_, i) => emptyQuestion(i + 1))
  );

  const updateQuestion = (localId: string, patch: Partial<QuestionDraft>) => {
    setQuestions((qs) =>
      qs.map((q) => (q._localId === localId ? { ...q, ...patch } : q))
    );
  };

  const addQuestion = () => {
    setQuestions((qs) => [...qs, emptyQuestion(qs.length + 1)]);
  };

  const removeQuestion = (localId: string) => {
    setQuestions((qs) =>
      qs
        .filter((q) => q._localId !== localId)
        .map((q, i) => ({ ...q, order: i + 1 }))
    );
  };

  const duplicateQuestion = (localId: string) => {
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q._localId === localId);
      if (idx < 0) return qs;
      const copy: QuestionDraft = {
        ...qs[idx],
        _localId: uid(),
      };
      const next = [...qs.slice(0, idx + 1), copy, ...qs.slice(idx + 1)];
      return next.map((q, i) => ({ ...q, order: i + 1 }));
    });
  };

  const moveQuestion = (localId: string, delta: number) => {
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q._localId === localId);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next.map((q, i) => ({ ...q, order: i + 1 }));
    });
  };

  const validate = (): string | null => {
    for (const q of questions) {
      if (!q.statement.trim()) return "Preencha o enunciado de todas as questões";
      if (!q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
        return "Todas as 4 alternativas são obrigatórias em cada questão";
      }
      if (!["a", "b", "c", "d"].includes(q.correct_option)) {
        return "Selecione a alternativa correta em cada questão";
      }
    }
    return null;
  };

  const handleSaveAll = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!activityId) {
      toast.error(disabledReason || "Crie a atividade antes de salvar questões");
      return;
    }
    await onSaveAll(questions);
  };

  const disabled = !activityId;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-slate-500" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={activityId ? "success" : "neutral"}>
            {activityId ? `Activity ID ${activityId}` : "Aguardando atividade"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {disabled && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              {disabledReason ||
                "Você precisa criar a atividade correspondente antes de cadastrar as questões."}
            </p>
          </div>
        )}

        <div className={cn("flex flex-col gap-4", disabled && "opacity-60 pointer-events-none")}>
          {questions.map((q, i) => (
            <QuestionRow
              key={q._localId}
              q={q}
              index={i}
              total={questions.length}
              onChange={(patch) => updateQuestion(q._localId, patch)}
              onRemove={() => removeQuestion(q._localId)}
              onDuplicate={() => duplicateQuestion(q._localId)}
              onMoveUp={() => moveQuestion(q._localId, -1)}
              onMoveDown={() => moveQuestion(q._localId, 1)}
              canRemove={questions.length > 1}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={addQuestion}
            icon={<Plus className="h-4 w-4" />}
            disabled={disabled}
          >
            Adicionar questão
          </Button>
          <Button
            onClick={handleSaveAll}
            loading={submitting}
            icon={<Save className="h-4 w-4" />}
            disabled={disabled}
          >
            Salvar {questions.length} questão(ões)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuestionRowProps {
  q: QuestionDraft;
  index: number;
  total: number;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canRemove: boolean;
}

function QuestionRow({
  q,
  index,
  total,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canRemove,
}: QuestionRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold inline-flex items-center justify-center">
            {q.order}
          </span>
          <span className="text-sm font-semibold text-slate-800">
            Questão {q.order}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Mover para cima"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            title="Mover para baixo"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
            title="Duplicar"
          >
            <Copy className="h-4 w-4" />
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Textarea
        label="Enunciado"
        required
        rows={2}
        value={q.statement}
        onChange={(e) => onChange({ statement: e.target.value })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        {(["a", "b", "c", "d"] as const).map((opt) => (
          <OptionInput
            key={opt}
            letter={opt}
            value={q[`option_${opt}` as const]}
            correct={q.correct_option === opt}
            onChange={(val) => onChange({ [`option_${opt}`]: val } as never)}
            onMarkCorrect={() => onChange({ correct_option: opt as CorrectOption })}
          />
        ))}
      </div>
    </div>
  );
}

function OptionInput({
  letter,
  value,
  correct,
  onChange,
  onMarkCorrect,
}: {
  letter: "a" | "b" | "c" | "d";
  value: string;
  correct: boolean;
  onChange: (v: string) => void;
  onMarkCorrect: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-2 transition-colors",
        correct
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[11px] font-semibold uppercase text-slate-500">
          Alternativa {letter.toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onMarkCorrect}
          className={cn(
            "text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors",
            correct
              ? "bg-emerald-600 text-white border-emerald-600"
              : "text-slate-600 border-slate-300 hover:bg-slate-100"
          )}
        >
          {correct ? "Correta" : "Marcar correta"}
        </button>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Texto da alternativa ${letter.toUpperCase()}`}
      />
    </div>
  );
}
