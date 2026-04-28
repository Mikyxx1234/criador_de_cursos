import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { quizSchema } from "./activitySchemas";
import type { ActivityCreateDTO, ActivityResponse } from "@/types/activity";

type FormValues = z.infer<typeof quizSchema>;

interface QuizFormProps {
  initial?: ActivityResponse | null;
  onSubmit: (dto: Extract<ActivityCreateDTO, { type: "quiz" }>) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
}

export function QuizForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Salvar atividade",
}: QuizFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(quizSchema) as never,
    defaultValues: {
      title: initial?.title ?? "",
      quiz: {
        description: initial?.quiz?.description ?? "",
        duration_minutes: initial?.quiz?.duration_minutes ?? 15,
        passing_score: initial?.quiz?.passing_score ?? 60,
      },
    },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      type: "quiz",
      title: values.title,
      quiz: {
        description: values.quiz.description || undefined,
        duration_minutes: values.quiz.duration_minutes ?? undefined,
        passing_score: values.quiz.passing_score ?? undefined,
      },
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Título"
        required
        placeholder="Ex.: Quiz — Módulo fundamentos"
        error={errors.title?.message}
        {...register("title")}
      />
      <Textarea
        label="Descrição"
        rows={3}
        error={errors.quiz?.description?.message as string}
        {...register("quiz.description")}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          type="number"
          label="Duração (minutos)"
          error={errors.quiz?.duration_minutes?.message as string}
          {...register("quiz.duration_minutes", {
            setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
          })}
        />
        <Input
          type="number"
          step="0.1"
          label="Nota de corte (%)"
          hint="Padrão sugerido: 60"
          error={errors.quiz?.passing_score?.message as string}
          {...register("quiz.passing_score", {
            setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
          })}
        />
      </div>

      <div className="rounded-xl bg-brand-50/60 border border-brand-100 p-3 text-xs text-brand-800">
        Depois de salvar o quiz, você poderá adicionar questões na etapa 3.
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={submitting}
          icon={<Save className="h-4 w-4" />}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
