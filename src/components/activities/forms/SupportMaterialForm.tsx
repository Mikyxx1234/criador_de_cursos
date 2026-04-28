import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { supportSchema } from "./activitySchemas";
import type { ActivityCreateDTO, ActivityResponse } from "@/types/activity";
import { htmlToPlainText, plainTextToHtml } from "@/lib/utils";

type FormValues = z.infer<typeof supportSchema>;

interface SupportMaterialFormProps {
  initial?: ActivityResponse | null;
  onSubmit: (
    dto: Extract<ActivityCreateDTO, { type: "support_material" }>
  ) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
}

export function SupportMaterialForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Salvar atividade",
}: SupportMaterialFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(supportSchema) as never,
    defaultValues: {
      title: initial?.title ?? "",
      support_material: {
        description: initial?.support_material?.description ?? "",
        content_richtext: htmlToPlainText(
          initial?.support_material?.content_richtext
        ),
      },
    },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      type: "support_material",
      title: values.title,
      support_material: {
        description: values.support_material.description || undefined,
        content_richtext: plainTextToHtml(
          values.support_material.content_richtext
        ),
      },
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Título"
        required
        placeholder="Ex.: Apostila PDF e links"
        error={errors.title?.message}
        {...register("title")}
      />
      <Textarea
        label="Descrição"
        rows={2}
        error={errors.support_material?.description?.message as string}
        {...register("support_material.description")}
      />
      <Textarea
        label="Conteúdo"
        required
        rows={10}
        placeholder={"Descreva o material de apoio em texto simples.\nUse uma linha em branco para separar parágrafos."}
        hint="Pode escrever normal — as quebras de linha e parágrafos são preservados."
        error={errors.support_material?.content_richtext?.message as string}
        {...register("support_material.content_richtext")}
      />
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
