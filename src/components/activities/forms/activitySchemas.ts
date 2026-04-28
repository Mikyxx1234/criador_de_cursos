import { z } from "zod";

export const videoSchema = z.object({
  title: z.string().min(3, "Título com ao menos 3 caracteres"),
  video: z.object({
    description: z.string().optional().or(z.literal("")),
    transcript: z.string().optional().or(z.literal("")),
    link: z.string().url("Link deve ser uma URL válida"),
    duration: z
      .number({ invalid_type_error: "Duração inválida" })
      .min(0, "Duração não pode ser negativa")
      .optional()
      .nullable(),
  }),
});

export const articleSchema = z.object({
  title: z.string().min(3),
  article: z.object({
    description: z.string().optional().or(z.literal("")),
    content_richtext: z.string().min(1, "Conteúdo obrigatório"),
  }),
});

export const embedSchema = z.object({
  title: z.string().min(3),
  embed_content: z.object({
    description: z.string().optional().or(z.literal("")),
    embed_code: z.string().min(1, "Embed code obrigatório"),
  }),
});

export const supportSchema = z.object({
  title: z.string().min(3),
  support_material: z.object({
    description: z.string().optional().or(z.literal("")),
    content_richtext: z.string().min(1, "Conteúdo obrigatório"),
  }),
});

export const quizSchema = z.object({
  title: z.string().min(3),
  quiz: z.object({
    description: z.string().optional().or(z.literal("")),
    duration_minutes: z
      .number()
      .min(0, "Duração não pode ser negativa")
      .optional()
      .nullable(),
    passing_score: z
      .number()
      .min(0, "Mínimo 0")
      .max(100, "Máximo 100")
      .optional()
      .nullable(),
  }),
});

export const finalExamSchema = z.object({
  title: z.string().min(3),
  final_exam: z.object({
    description: z.string().optional().or(z.literal("")),
    max_attempts: z
      .number({ invalid_type_error: "Informe de 1 a 3" })
      .min(1, "Mínimo 1")
      .max(3, "Máximo 3"),
    duration_minutes: z
      .number({ invalid_type_error: "Duração obrigatória" })
      .min(1, "Duração mínima de 1 minuto"),
    passing_score: z
      .number()
      .min(0, "Mínimo 0")
      .max(100, "Máximo 100")
      .optional()
      .nullable(),
  }),
});
