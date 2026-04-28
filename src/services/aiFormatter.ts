import { getCourse } from "./courseService";
import { updateActivity } from "./activityService";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `Você é um revisor de FORMATAÇÃO HTML de artigos de cursos.

REGRAS RÍGIDAS:
1. NUNCA altere o conteúdo textual. Não reescreva, não traduza, não resuma, não adicione informações novas, não corrija "erros".
2. Sua única tarefa é detectar quebras visuais e RESTRUTURAR o HTML, mantendo cada palavra original intacta.
3. Detecte tabelas que foram quebradas em parágrafos soltos (cabeçalhos seguidos de linhas de dados na mesma ordem) e reconstrua-as como <table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>.
4. Detecte listas que viraram parágrafos soltos e use <ul><li>...</li></ul> (ou <ol> quando houver numeração explícita).
5. Use <h2> ou <h3> para títulos óbvios de seção (texto curto seguido de dois-pontos no fim, ou um título destacado seguido por explicação).
6. Use <strong> apenas onde já houvesse ênfase clara (rótulos como "Definição:", "Importante:", "Exemplo:").
7. NÃO use HTML inválido. NÃO use atributos style/class. Use apenas tags semânticas: h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, strong, em, br, code.
8. Se você não tiver certeza absoluta de que algo é tabela/lista, mantenha como <p> normal.
9. Retorne EXCLUSIVAMENTE o HTML reformatado. Sem markdown, sem cercas \`\`\`, sem explicações antes ou depois, sem comentários.`;

export interface ArticleToFix {
  activityId: number;
  title: string;
  contentHtml: string;
}

export interface AIFormatProgress {
  total: number;
  current: number;
  message: string;
  type: "info" | "success" | "error";
}

export interface AIFormatResult {
  total: number;
  fixed: number;
  failed: number;
  errors: string[];
}

function getApiKey(): string {
  const key = (import.meta.env.VITE_OPENAI_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "VITE_OPENAI_API_KEY não está definida. Configure no .env e refaça o build."
    );
  }
  return key;
}

async function callOpenAI(html: string): Promise<string> {
  const apiKey = getApiKey();
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `HTML do artigo a revisar:\n\n${html}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(
      `OpenAI ${res.status}: ${errBody.slice(0, 200) || res.statusText}`
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI retornou resposta vazia.");
  }
  return stripFences(content);
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/);
  return m ? m[1].trim() : trimmed;
}

/**
 * Sanidade básica antes de salvar: o HTML reformatado precisa ter
 * tamanho razoavelmente próximo do original (±60%) para não engolirmos
 * conteúdo silenciosamente caso a IA delire.
 */
function isPlausibleRewrite(original: string, rewritten: string): boolean {
  if (!rewritten) return false;
  const orig = stripTags(original);
  const next = stripTags(rewritten);
  if (next.length === 0) return false;
  const ratio = next.length / Math.max(orig.length, 1);
  return ratio >= 0.6 && ratio <= 1.6;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lista todos os artigos de um curso que possuem `content_richtext`
 * (apenas atividades do tipo "article" entram no agente de formatação).
 */
export async function fetchArticlesForFormatting(
  courseId: number
): Promise<ArticleToFix[]> {
  const course = await getCourse(courseId);
  const activities = (course.activities ?? []) as Array<{
    id: number;
    title?: string;
    type?: string;
    article?: { content_richtext?: string | null };
  }>;
  return activities
    .filter(
      (a) =>
        a.type === "article" &&
        typeof a.article?.content_richtext === "string" &&
        (a.article?.content_richtext || "").trim().length > 0
    )
    .map((a) => ({
      activityId: a.id,
      title: a.title || `Atividade ${a.id}`,
      contentHtml: a.article?.content_richtext as string,
    }));
}

/**
 * Roda o agente de formatação em todos os artigos do curso. Para cada
 * artigo: chama a OpenAI, valida a saída e (se OK) faz PUT no backend.
 * O callback `onProgress` é chamado a cada passo para exibir status na UI.
 */
export async function runFormattingAgent(
  courseId: number,
  onProgress: (p: AIFormatProgress) => void,
  options: { signal?: AbortSignal } = {}
): Promise<AIFormatResult> {
  const articles = await fetchArticlesForFormatting(courseId);
  const total = articles.length;

  if (total === 0) {
    onProgress({
      total: 0,
      current: 0,
      type: "info",
      message: "Nenhum artigo encontrado para revisar.",
    });
    return { total: 0, fixed: 0, failed: 0, errors: [] };
  }

  onProgress({
    total,
    current: 0,
    type: "info",
    message: `${total} artigo(s) serão analisados pela IA.`,
  });

  let fixed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < articles.length; i++) {
    if (options.signal?.aborted) {
      onProgress({
        total,
        current: i,
        type: "error",
        message: "Operação cancelada pelo usuário.",
      });
      break;
    }
    const a = articles[i];
    const idx = i + 1;
    onProgress({
      total,
      current: i,
      type: "info",
      message: `[${idx}/${total}] Revisando "${a.title}"...`,
    });

    try {
      const rewritten = await callOpenAI(a.contentHtml);

      if (!isPlausibleRewrite(a.contentHtml, rewritten)) {
        failed += 1;
        const msg = `[${idx}/${total}] "${a.title}": resposta da IA fora do tamanho esperado, mantendo original.`;
        errors.push(msg);
        onProgress({ total, current: idx, type: "error", message: msg });
        continue;
      }

      if (rewritten.trim() === a.contentHtml.trim()) {
        onProgress({
          total,
          current: idx,
          type: "info",
          message: `[${idx}/${total}] "${a.title}": já estava OK, nada mudou.`,
        });
        continue;
      }

      await updateActivity(a.activityId, {
        type: "article",
        article: { content_richtext: rewritten },
      } as never);

      fixed += 1;
      onProgress({
        total,
        current: idx,
        type: "success",
        message: `[${idx}/${total}] "${a.title}" reformatado e salvo.`,
      });
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`"${a.title}": ${msg}`);
      onProgress({
        total,
        current: idx,
        type: "error",
        message: `[${idx}/${total}] Falha em "${a.title}": ${msg}`,
      });
    }
  }

  onProgress({
    total,
    current: total,
    type: failed === 0 ? "success" : "info",
    message: `Concluído. ${fixed} corrigido(s), ${failed} falha(s) de ${total}.`,
  });

  return { total, fixed, failed, errors };
}
