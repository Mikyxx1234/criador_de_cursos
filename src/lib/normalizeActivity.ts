import type { ActivityResponse, ActivityType } from "@/types/activity";

const TYPE_ALIASES: Record<string, ActivityType> = {
  video: "video",
  videos: "video",
  aula: "video",
  videoactivity: "video",

  article: "article",
  articles: "article",
  artigo: "article",
  text: "article",
  texto: "article",
  articleactivity: "article",

  embed: "embed_content",
  embed_content: "embed_content",
  "embed-content": "embed_content",
  embedcontent: "embed_content",
  iframe: "embed_content",
  embedcontentactivity: "embed_content",
  embedactivity: "embed_content",

  support: "support_material",
  support_material: "support_material",
  "support-material": "support_material",
  supportmaterial: "support_material",
  material: "support_material",
  material_apoio: "support_material",
  supportmaterialactivity: "support_material",

  quiz: "quiz",
  quizzes: "quiz",
  questionario: "quiz",
  questionário: "quiz",
  quizactivity: "quiz",

  final_exam: "final_exam",
  "final-exam": "final_exam",
  finalexam: "final_exam",
  final: "final_exam",
  exam: "final_exam",
  prova_final: "final_exam",
  "prova-final": "final_exam",
  prova: "final_exam",
  avaliacao_final: "final_exam",
  finalexamactivity: "final_exam",
  examactivity: "final_exam",
};

/**
 * Laravel devolve polymorphic como `App\\Models\\ArticleActivity`. Removemos o
 * namespace e aplicamos lower-case antes de bater com os aliases.
 */
function stripClassName(value: string): string {
  const base = value.trim().split("\\").pop() ?? value;
  return base.toLowerCase().replace(/[_\-\s]/g, "");
}

function mapType(value: unknown): ActivityType | null {
  if (!value) return null;
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
    const stripped = stripClassName(value);
    if (TYPE_ALIASES[stripped]) return TYPE_ALIASES[stripped];
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return (
      mapType(obj.code) ??
      mapType(obj.slug) ??
      mapType(obj.name) ??
      mapType(obj.type) ??
      mapType(obj.value) ??
      mapType(obj.key) ??
      null
    );
  }
  return null;
}

function extractTypeFromRaw(raw: Record<string, unknown>): ActivityType | null {
  const polymorphic = raw.activityable as
    | { type?: unknown; data?: unknown }
    | undefined;
  return (
    mapType(polymorphic?.type) ??
    mapType(raw.type) ??
    mapType(raw.activity_type) ??
    mapType(raw.activityType) ??
    mapType(raw.activity_type_code) ??
    mapType(raw.activity_type_slug) ??
    mapType(raw.activity_type_name) ??
    mapType(raw.type_code) ??
    mapType(raw.type_slug) ??
    mapType(raw.type_name) ??
    mapType(raw.kind) ??
    null
  );
}

/**
 * Último recurso: tenta inferir o tipo pelo prefixo do título, seguindo as
 * convenções que o nosso importador cria (ex.: "Quiz: ..." → quiz,
 * "Módulo 3: ..." → article, "Prova Final — ..." → final_exam).
 */
function guessTypeFromTitle(title: string): ActivityType | null {
  const t = title.trim().toLowerCase();
  if (!t) return null;
  if (
    t.startsWith("quiz:") ||
    t.startsWith("quiz ") ||
    /^quiz\s*[-–—:]/i.test(t)
  )
    return "quiz";
  if (
    t.startsWith("prova final") ||
    t.startsWith("avaliação final") ||
    t.startsWith("avaliacao final") ||
    t.startsWith("prova:") ||
    t.startsWith("exame final")
  )
    return "final_exam";
  if (
    t.startsWith("módulo") ||
    t.startsWith("modulo") ||
    t.startsWith("aula ") ||
    t.startsWith("capítulo") ||
    t.startsWith("capitulo") ||
    t.startsWith("artigo:")
  )
    return "article";
  if (t.startsWith("vídeo:") || t.startsWith("video:")) return "video";
  if (t.startsWith("material:") || t.startsWith("apostila:"))
    return "support_material";
  if (t.startsWith("embed:") || t.startsWith("genially"))
    return "embed_content";
  return null;
}

function pickObject(
  raw: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const v = raw[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  }
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function extractId(obj: Record<string, unknown> | null): number | undefined {
  if (!obj) return undefined;
  const id = obj.id ?? obj.ID ?? obj._id;
  const n = Number(id);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeActivity(raw: unknown): ActivityResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // Laravel devolve polymorphic em `activityable: { type, data }`. Se isso
  // existir, promovemos `data` para o campo específico correspondente — assim
  // o restante do extractor funciona mesmo sem nenhuma mudança.
  const polymorphic = r.activityable as
    | { type?: unknown; data?: unknown }
    | undefined;
  if (
    polymorphic &&
    typeof polymorphic === "object" &&
    polymorphic.data &&
    typeof polymorphic.data === "object"
  ) {
    const polyType = mapType(polymorphic.type);
    if (polyType && !r[polyType]) {
      r[polyType] = polymorphic.data;
    }
  }

  const type = extractTypeFromRaw(r);
  if (!type) {
    console.warn(
      "[normalizeActivity] Não foi possível identificar o tipo da atividade.",
      r
    );
  }

  const id = toNumber(r.id ?? r.ID ?? r._id, 0);
  const nestedCourse = r.course as { id?: unknown } | undefined;
  const courseId = toNumber(
    r.course_id ?? r.courseId ?? nestedCourse?.id,
    0
  );
  const order = toNumber(r.order ?? r.position ?? r.sort ?? 0, 0);
  const title = String(r.title ?? r.name ?? r.label ?? "Atividade");

  const finalType: ActivityType = type ?? "article";

  const activity: ActivityResponse = {
    id,
    course_id: courseId,
    type: finalType,
    title,
    order,
    created_at: typeof r.created_at === "string" ? r.created_at : undefined,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : undefined,
  };

  const video = pickObject(r, [
    "video",
    "videoActivity",
    "video_activity",
    "videoable",
  ]);
  if (video) {
    const vid = extractId(video);
    activity.video = {
      id: vid ?? 0,
      link: String(video.link ?? video.url ?? video.src ?? ""),
      description:
        typeof video.description === "string" ? video.description : undefined,
      transcript:
        typeof video.transcript === "string" ? video.transcript : undefined,
      duration: Number(video.duration ?? 0) || 0,
    };
  }

  const article = pickObject(r, [
    "article",
    "articleActivity",
    "article_activity",
    "articleable",
  ]);
  if (article) {
    activity.article = {
      id: extractId(article) ?? 0,
      content_richtext: String(
        article.content_richtext ??
          article.content ??
          article.body ??
          article.text ??
          ""
      ),
      description:
        typeof article.description === "string"
          ? article.description
          : undefined,
    };
  }

  const embed = pickObject(r, [
    "embed_content",
    "embedContent",
    "embed",
    "embedable",
  ]);
  if (embed) {
    activity.embed_content = {
      id: extractId(embed) ?? 0,
      embed_code: String(
        embed.embed_code ?? embed.code ?? embed.iframe ?? embed.content ?? ""
      ),
      description:
        typeof embed.description === "string" ? embed.description : undefined,
    };
  }

  const support = pickObject(r, [
    "support_material",
    "supportMaterial",
    "support",
    "material",
  ]);
  if (support) {
    activity.support_material = {
      id: extractId(support) ?? 0,
      content_richtext: String(
        support.content_richtext ??
          support.content ??
          support.body ??
          support.text ??
          ""
      ),
      description:
        typeof support.description === "string"
          ? support.description
          : undefined,
    };
  }

  const quiz = pickObject(r, ["quiz", "quizActivity", "quiz_activity"]);
  if (quiz) {
    activity.quiz = {
      id: extractId(quiz) ?? 0,
      description:
        typeof quiz.description === "string" ? quiz.description : undefined,
      duration_minutes: Number(
        quiz.duration_minutes ?? quiz.duration ?? 0
      ) || 0,
      passing_score: Number(
        quiz.passing_score ?? quiz.min_score ?? quiz.passing ?? 0
      ) || 0,
    };
  }

  const finalExam = pickObject(r, [
    "final_exam",
    "finalExam",
    "final_exam_activity",
    "exam",
  ]);
  if (finalExam) {
    activity.final_exam = {
      id: extractId(finalExam) ?? 0,
      description:
        typeof finalExam.description === "string"
          ? finalExam.description
          : undefined,
      max_attempts: Number(
        finalExam.max_attempts ?? finalExam.attempts ?? 3
      ) || 3,
      duration_minutes: Number(
        finalExam.duration_minutes ?? finalExam.duration ?? 60
      ) || 60,
      passing_score: Number(
        finalExam.passing_score ?? finalExam.min_score ?? 70
      ) || 70,
    };
  }

  // Fallbacks: se o tipo não foi identificado, derivamos a partir de (a) qualquer
  // payload aninhado que tenha chegado, e (b) do padrão do título gerado pelo
  // importador do frontend — isso cobre o caso em que o backend retorna a lista
  // de atividades sem o campo "type" nem as relações aninhadas.
  if (!type) {
    if (activity.quiz) activity.type = "quiz";
    else if (activity.final_exam) activity.type = "final_exam";
    else if (activity.video) activity.type = "video";
    else if (activity.embed_content) activity.type = "embed_content";
    else if (activity.support_material) activity.type = "support_material";
    else if (activity.article) activity.type = "article";
    else {
      const guessed = guessTypeFromTitle(title);
      if (guessed) activity.type = guessed;
    }
  }

  // Se ainda não temos payload aninhado mas inferimos o tipo quiz/final_exam,
  // vamos também criar um stub mínimo para que o campo `id` aninhado aponte
  // para o próprio `activity.id`. Vários backends usam o mesmo ID para a
  // relação polimórfica — se não for o caso, o usuário vai ver claramente
  // no card qual ID usar (o interno vira o mesmo que o externo, que já está
  // disponível como fallback nos endpoints de questões).
  if (activity.type === "quiz" && !activity.quiz) {
    activity.quiz = {
      id: activity.id,
      duration_minutes: 0,
      passing_score: 0,
    };
  }
  if (activity.type === "final_exam" && !activity.final_exam) {
    activity.final_exam = {
      id: activity.id,
      max_attempts: 3,
      duration_minutes: 60,
      passing_score: 70,
    };
  }

  return activity;
}

export function normalizeActivityList(raw: unknown): ActivityResponse[] {
  if (!Array.isArray(raw)) return [];
  const list: ActivityResponse[] = [];
  for (const item of raw) {
    const a = normalizeActivity(item);
    if (a) list.push(a);
  }
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list;
}
