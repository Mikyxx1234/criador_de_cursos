export type ActivityType =
  | "video"
  | "article"
  | "embed_content"
  | "support_material"
  | "quiz"
  | "final_exam";

export const ACTIVITY_TYPES: {
  value: ActivityType;
  label: string;
  description: string;
}[] = [
  {
    value: "video",
    label: "Vídeo",
    description: "Aula em vídeo incorporada (YouTube, Vimeo, etc.)",
  },
  {
    value: "article",
    label: "Artigo",
    description: "Leitura com conteúdo em HTML rich text",
  },
  {
    value: "embed_content",
    label: "Conteúdo incorporado",
    description: "Iframe/embed (Genially, Canva, etc.)",
  },
  {
    value: "support_material",
    label: "Material de apoio",
    description: "Apostila, PDF, links e resumos",
  },
  {
    value: "quiz",
    label: "Quiz",
    description: "Questionário com múltiplas escolhas",
  },
  {
    value: "final_exam",
    label: "Prova Final",
    description: "Única por curso - sempre última atividade",
  },
];

export interface VideoPayload {
  description?: string;
  transcript?: string;
  link: string;
  duration?: number;
}

export interface ArticlePayload {
  description?: string;
  content_richtext: string;
}

export interface EmbedPayload {
  description?: string;
  embed_code: string;
}

export interface SupportMaterialPayload {
  description?: string;
  content_richtext: string;
}

export interface QuizPayload {
  description?: string;
  duration_minutes?: number;
  passing_score?: number;
}

export interface FinalExamPayload {
  description?: string;
  max_attempts: number;
  duration_minutes: number;
  passing_score?: number;
}

export type ActivityCreateDTO =
  | { type: "video"; title: string; order?: number; video: VideoPayload }
  | { type: "article"; title: string; order?: number; article: ArticlePayload }
  | {
      type: "embed_content";
      title: string;
      order?: number;
      embed_content: EmbedPayload;
    }
  | {
      type: "support_material";
      title: string;
      order?: number;
      support_material: SupportMaterialPayload;
    }
  | { type: "quiz"; title: string; order?: number; quiz: QuizPayload }
  | {
      type: "final_exam";
      title: string;
      order?: number;
      final_exam: FinalExamPayload;
    };

export interface ActivityResponse {
  id: number;
  course_id: number;
  type: ActivityType;
  title: string;
  order: number;
  video?: (VideoPayload & { id: number }) | null;
  article?: (ArticlePayload & { id: number }) | null;
  embed_content?: (EmbedPayload & { id: number }) | null;
  support_material?: (SupportMaterialPayload & { id: number }) | null;
  quiz?: (QuizPayload & { id: number }) | null;
  final_exam?: (FinalExamPayload & { id: number }) | null;
  created_at?: string;
  updated_at?: string;
}
