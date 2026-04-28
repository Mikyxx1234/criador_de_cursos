import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { finalExamSchema } from "./activitySchemas";
import type { ActivityCreateDTO, ActivityResponse } from "@/types/activity";

type FormValues = z.infer<typeof finalExamSchema>;

interface FinalExamFormProps {
  initial?: ActivityResponse | null;
  onSubmit: (
    dto: Extract<ActivityCreateDTO, { type: "final_exam" }>
  ) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
}

export function FinalExamForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Salvar prova final",
}: FinalExamFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(finalExamSchema) as never,
    defaultValues: {
      title: initial?.title ?? "Prova final — certificação",
      final_exam: {
        description: initial?.final_exam?.description ?? "",
        max_attempts: initial?.final_exam?.max_attempts ?? 3,
        duration_minutes: initial?.final_exam?.duration_minutes ?? 60,
        passing_score: initial?.final_exam?.passing_score ?? 70,
      },
    },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      type: "final_exam",
      title: values.title,
      final_exam: {
        description: values.final_exam.description || undefined,
        max_attempts: values.final_exam.max_attempts,
        duration_minutes: values.final_exam.duration_minutes,
        passing_score: values.final_exam.passing_score ?? undefined,
      },
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Título"
        required
        error={errors.title?.message}
        {...register("title")}
      />
      <Textarea
        label="Descrição"
        rows={3}
        error={errors.final_exam?.description?.message as string}
        {...register("final_exam.description")}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          type="number"
          label="Tentativas máx."
          required
          min={1}
          max={3}
          hint="De 1 a 3"
          error={errors.final_exam?.max_attempts?.message as string}
          {...register("final_exam.max_attempts", { valueAsNumber: true })}
        />
        <Input
          type="number"
          label="Duração (min)"
          required
          min={1}
          error={errors.final_exam?.duration_minutes?.message as string}
          {...register("final_exam.duration_minutes", { valueAsNumber: true })}
        />
        <Input
          type="number"
          step="0.1"
          label="Nota de corte (%)"
          hint="Padrão sugerido: 70"
          error={errors.final_exam?.passing_score?.message as string}
          {...register("final_exam.passing_score", {
            setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
          })}
        />
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <strong>Atenção:</strong> A prova final é única por curso e será sempre
        posicionada como última atividade, mesmo se você definir outra ordem.
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
