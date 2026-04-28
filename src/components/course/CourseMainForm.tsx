import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save, Image as ImageIcon } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { FileDrop } from "@/components/ui/FileDrop";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

import {
  CATEGORIES,
  CourseFormValues,
  CourseResponse,
  DIFFICULTY_LEVELS,
} from "@/types/course";
import { createCourse, updateCourse } from "@/services/courseService";
import { parseApiError } from "@/services/apiClient";
import { useCachedCoverUrl } from "@/lib/coverCache";
import { sanitizeImageUrl } from "@/lib/imageUrl";

const courseSchema = z.object({
  title: z.string().min(3, "Informe um título com pelo menos 3 caracteres"),
  description: z.string().min(10, "Descrição deve ter ao menos 10 caracteres"),
  short_description: z.string().max(500, "Máximo de 500 caracteres").optional().or(z.literal("")),
  workload: z
    .number({ invalid_type_error: "Carga horária inválida" })
    .min(1, "Carga horária mínima de 1h"),
  modules_count: z.number().min(0).optional().nullable(),
  difficulty_level: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  price: z
    .number({ invalid_type_error: "Informe o preço" })
    .min(0, "Preço não pode ser negativo"),
  promotional_price: z.number().min(0).optional().nullable(),
  discount_percentage: z.number().min(0).max(100).optional().nullable(),
  is_active: z.boolean(),
  cover_image: z.any().optional().nullable(),
});

interface CourseMainFormProps {
  existingCourse: CourseResponse | null;
  onCreated: (course: CourseResponse) => void;
  onUpdated: (course: CourseResponse) => void;
}

export function CourseMainForm({
  existingCourse,
  onCreated,
  onUpdated,
}: CourseMainFormProps) {
  const isEditing = Boolean(existingCourse);
  const cachedCover = useCachedCoverUrl(existingCourse?.id ?? null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema) as never,
    defaultValues: {
      title: "",
      description: "",
      short_description: "",
      workload: 10,
      modules_count: 0,
      difficulty_level: "",
      category: "",
      price: 0,
      promotional_price: null,
      discount_percentage: null,
      is_active: true,
      cover_image: null,
    },
  });

  useEffect(() => {
    if (existingCourse) {
      reset({
        title: existingCourse.title ?? "",
        description: existingCourse.description ?? "",
        short_description: existingCourse.short_description ?? "",
        workload: existingCourse.workload ?? 10,
        modules_count: existingCourse.modules_count ?? 0,
        difficulty_level: (existingCourse.difficulty_level as never) ?? "",
        category: (existingCourse.category as never) ?? "",
        price: Number(existingCourse.price ?? 0),
        promotional_price: existingCourse.promotional_price
          ? Number(existingCourse.promotional_price)
          : null,
        discount_percentage: existingCourse.discount_percentage ?? null,
        is_active: !!existingCourse.is_active,
        cover_image: null,
      });
    }
  }, [existingCourse, reset]);

  const coverImage = watch("cover_image");

  const onSubmit = async (values: CourseFormValues) => {
    try {
      if (!isEditing && !(values.cover_image instanceof File)) {
        toast.error("A capa do curso é obrigatória no cadastro inicial.");
        return;
      }

      const payload: CourseFormValues = {
        ...values,
        difficulty_level: (values.difficulty_level || "") as never,
        category: (values.category || "") as never,
      };

      const promise = isEditing
        ? updateCourse(existingCourse!.id, payload)
        : createCourse(payload);

      toast.promise(promise, {
        loading: isEditing ? "Atualizando curso..." : "Criando curso...",
        success: isEditing
          ? "Curso atualizado com sucesso!"
          : "Curso criado! Agora você pode adicionar atividades.",
        error: (e) => {
          const parsed = parseApiError(e);
          console.error("[CourseMainForm] erro ao salvar curso:", parsed);
          return parsed.message || "Falha ao salvar curso";
        },
      });

      const course = await promise;
      console.log("[CourseMainForm] resposta do backend:", course);
      console.log(
        "[CourseMainForm] cover_image_url retornada:",
        course.cover_image_url
      );
      if (!course.cover_image_url) {
        console.warn(
          "[CourseMainForm] Atenção: backend não retornou cover_image_url. " +
            "O arquivo pode não ter sido persistido."
        );
      }
      if (isEditing) {
        onUpdated(course);
      } else {
        onCreated(course);
      }
    } catch {
      // erro já exibido pelo toast.promise
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Dados do curso</CardTitle>
            <CardDescription>
              Informações principais que aparecem na vitrine.
            </CardDescription>
          </div>
          {existingCourse && (
            <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
              ID: {existingCourse.id}
            </div>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Título"
              required
              placeholder="Ex.: Laravel do Zero ao Avançado"
              error={errors.title?.message}
              {...register("title")}
            />
          </div>

          <div className="md:col-span-2">
            <Textarea
              label="Descrição"
              required
              rows={4}
              placeholder="Descrição completa do curso (aparece em listagens e detalhes)"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>

          <div className="md:col-span-2">
            <Textarea
              label="Descrição curta"
              rows={2}
              placeholder="Resumo de até 500 caracteres"
              error={errors.short_description?.message}
              {...register("short_description")}
            />
          </div>

          <Input
            type="number"
            label="Carga horária (h)"
            required
            min={1}
            error={errors.workload?.message}
            {...register("workload", { valueAsNumber: true })}
          />

          <Input
            type="number"
            label="Número de módulos"
            min={0}
            error={errors.modules_count?.message}
            {...register("modules_count", { valueAsNumber: true })}
          />

          <Controller
            control={control}
            name="difficulty_level"
            render={({ field }) => (
              <Select
                label="Nível de dificuldade"
                placeholder="Selecione..."
                options={[
                  { value: "", label: "Selecione..." },
                  ...DIFFICULTY_LEVELS.map((d) => ({
                    value: d.value,
                    label: d.label,
                  })),
                ]}
                error={errors.difficulty_level?.message as string}
                {...field}
                value={field.value ?? ""}
              />
            )}
          />

          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                label="Categoria"
                placeholder="Selecione..."
                options={[
                  { value: "", label: "Selecione..." },
                  ...CATEGORIES.map((c) => ({
                    value: c.value,
                    label: c.label,
                  })),
                ]}
                error={errors.category?.message as string}
                {...field}
                value={field.value ?? ""}
              />
            )}
          />

          <Input
            type="number"
            step="0.01"
            label="Preço (R$)"
            required
            min={0}
            error={errors.price?.message}
            {...register("price", { valueAsNumber: true })}
          />

          <Input
            type="number"
            step="0.01"
            label="Preço promocional (R$)"
            min={0}
            hint="Deixe vazio se não houver promoção"
            error={errors.promotional_price?.message}
            {...register("promotional_price", {
              setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
            })}
          />

          <Input
            type="number"
            label="Desconto (%)"
            min={0}
            max={100}
            hint="Opcional. Entre 0 e 100"
            error={errors.discount_percentage?.message}
            {...register("discount_percentage", {
              setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
            })}
          />

          <div className="md:col-span-2">
            <Controller
              control={control}
              name="cover_image"
              render={({ field }) => (
                <FileDrop
                  value={field.value as File | null}
                  previewUrl={
                    cachedCover ??
                    sanitizeImageUrl(existingCourse?.cover_image_url) ??
                    null
                  }
                  onChange={(file) => setValue("cover_image", file)}
                  label="Capa do curso"
                  required={!isEditing}
                  hint="Obrigatória no cadastro inicial. Ao editar, envie somente se quiser substituir a capa atual."
                />
              )}
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  checked={!!field.value}
                  onChange={field.onChange}
                  label={field.value ? "Curso ativo" : "Curso inativo"}
                  description="Apenas cursos ativos aparecem publicamente para estudantes."
                />
              )}
            />
            <ImageIcon className="h-5 w-5 text-slate-400" />
          </div>
        </CardContent>

        <div className="px-6 py-4 border-t border-slate-200/80 flex items-center justify-end gap-2">
          <Button
            type="submit"
            loading={isSubmitting}
            icon={<Save className="h-4 w-4" />}
          >
            {isEditing ? "Salvar alterações" : "Criar curso"}
          </Button>
        </div>
      </Card>

      {coverImage instanceof File && (
        <p className="text-xs text-slate-500 -mt-2">
          Arquivo selecionado: {coverImage.name} (
          {(coverImage.size / 1024).toFixed(1)} KB)
        </p>
      )}
    </form>
  );
}
