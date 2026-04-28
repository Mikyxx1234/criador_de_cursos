import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { embedSchema } from "./activitySchemas";
import type { ActivityCreateDTO, ActivityResponse } from "@/types/activity";

type FormValues = z.infer<typeof embedSchema>;

interface EmbedFormProps {
  initial?: ActivityResponse | null;
  onSubmit: (
    dto: Extract<ActivityCreateDTO, { type: "embed_content" }>
  ) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
}

export function EmbedForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Salvar atividade",
}: EmbedFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(embedSchema) as never,
    defaultValues: {
      title: initial?.title ?? "",
      embed_content: {
        description: initial?.embed_content?.description ?? "",
        embed_code: initial?.embed_content?.embed_code ?? "",
      },
    },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      type: "embed_content",
      title: values.title,
      embed_content: {
        description: values.embed_content.description || undefined,
        embed_code: values.embed_content.embed_code,
      },
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Título"
        required
        placeholder="Ex.: Conteúdo interativo"
        error={errors.title?.message}
        {...register("title")}
      />
      <Textarea
        label="Descrição"
        rows={2}
        error={errors.embed_content?.description?.message as string}
        {...register("embed_content.description")}
      />
      <Textarea
        label="Embed code (iframe/script)"
        required
        rows={6}
        placeholder={`<iframe src="https://..." width="100%" height="480" frameborder="0" allowfullscreen></iframe>`}
        error={errors.embed_content?.embed_code?.message as string}
        {...register("embed_content.embed_code")}
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
