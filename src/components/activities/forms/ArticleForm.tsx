import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { articleSchema } from "./activitySchemas";
import type { ActivityCreateDTO, ActivityResponse } from "@/types/activity";
import { htmlToPlainText, plainTextToHtml } from "@/lib/utils";

type FormValues = z.infer<typeof articleSchema>;

interface ArticleFormProps {
  initial?: ActivityResponse | null;
  onSubmit: (
    dto: Extract<ActivityCreateDTO, { type: "article" }>
  ) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
}

export function ArticleForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Salvar atividade",
}: ArticleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(articleSchema) as never,
    defaultValues: {
      title: initial?.title ?? "",
      article: {
        description: initial?.article?.description ?? "",
        content_richtext: htmlToPlainText(initial?.article?.content_richtext),
      },
    },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      type: "article",
      title: values.title,
      article: {
        description: values.article.description || undefined,
        content_richtext: plainTextToHtml(values.article.content_richtext),
      },
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Título"
        required
        placeholder="Ex.: Conceitos de rotas e controllers"
        error={errors.title?.message}
        {...register("title")}
      />
      <Textarea
        label="Descrição"
        rows={2}
        error={errors.article?.description?.message as string}
        {...register("article.description")}
      />
      <Textarea
        label="Conteúdo"
        required
        rows={10}
        placeholder={"Escreva o conteúdo do artigo em texto simples.\nUse uma linha em branco para separar parágrafos."}
        hint="Pode escrever normal — as quebras de linha e parágrafos são preservados."
        error={errors.article?.content_richtext?.message as string}
        {...register("article.content_richtext")}
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
