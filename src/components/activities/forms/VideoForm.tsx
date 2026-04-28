import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { VideoUploader } from "@/components/ui/VideoUploader";
import { videoSchema } from "./activitySchemas";
import type { ActivityCreateDTO, ActivityResponse } from "@/types/activity";

type FormValues = z.infer<typeof videoSchema>;

interface VideoFormProps {
  initial?: ActivityResponse | null;
  onSubmit: (dto: Extract<ActivityCreateDTO, { type: "video" }>) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
}

export function VideoForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Salvar atividade",
}: VideoFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(videoSchema) as never,
    defaultValues: {
      title: initial?.title ?? "",
      video: {
        description: initial?.video?.description ?? "",
        transcript: initial?.video?.transcript ?? "",
        link: initial?.video?.link ?? "",
        duration: initial?.video?.duration ?? 0,
      },
    },
  });

  const currentLink = watch("video.link");

  const submit = handleSubmit(async (values) => {
    await onSubmit({
      type: "video",
      title: values.title,
      video: {
        description: values.video.description || undefined,
        transcript: values.video.transcript || undefined,
        link: values.video.link,
        duration: values.video.duration ?? undefined,
      },
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Input
        label="Título"
        required
        placeholder="Ex.: Introdução ao Laravel"
        error={errors.title?.message}
        {...register("title")}
      />

      <VideoUploader
        label="Enviar arquivo de vídeo (Supabase)"
        value={currentLink}
        onChange={(url) =>
          setValue("video.link", url, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        hint="Após o upload, a URL pública é preenchida automaticamente abaixo."
      />

      <Input
        label="Link do vídeo"
        required
        placeholder="https://... (preenchido automaticamente pelo upload) ou cole uma URL externa"
        error={errors.video?.link?.message}
        {...register("video.link")}
      />

      <Input
        type="number"
        label="Duração (segundos)"
        hint="Ex.: 1800 = 30 minutos"
        error={errors.video?.duration?.message as string}
        {...register("video.duration", {
          setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
        })}
      />
      <Textarea
        label="Descrição"
        rows={3}
        error={errors.video?.description?.message as string}
        {...register("video.description")}
      />
      <Textarea
        label="Transcrição"
        rows={4}
        error={errors.video?.transcript?.message as string}
        {...register("video.transcript")}
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
