export interface ParsedQuestion {
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
}

export type ParsedSubmoduleType = "article" | "quiz";

export interface ParsedSubmodule {
  /** Tipo do submódulo. Cada submódulo vira uma atividade no curso. */
  type: ParsedSubmoduleType;
  /** Título do submódulo (extraído do heading). */
  title: string;
  /** Conteúdo em texto puro (somente para `article`). */
  content: string;
  /** Questões parseadas (somente para `quiz`). */
  questions: ParsedQuestion[];
}

export interface ParsedModule {
  index: number;
  title: string;
  /** Lista de submódulos (artigos e quizzes intercalados). */
  submodules: ParsedSubmodule[];
}

export interface ParsedFinalExam {
  title: string;
  questions: ParsedQuestion[];
}

export interface ParsedCourse {
  title: string;
  shortDescription: string;
  description: string;
  workloadHours: number;
  category: string;
  difficulty: string;
  learningGoals: string;
  modules: ParsedModule[];
  finalExam: ParsedFinalExam | null;
}

export interface ParseDiagnostic {
  sectionsFound: string[];
  warnings: string[];
}

export interface ParseResult {
  course: ParsedCourse;
  diagnostic: ParseDiagnostic;
}

// ============================================================================
// Saneamento básico
// ============================================================================

function cleanSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function sanitize(text: string): string {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u200B-\u200F]/g, "")
    .replace(/✅/g, "__CORRECT__")
    .replace(/✓/g, "__CORRECT__");
}

function guessCategory(raw: string): string {
  const t = raw.toLowerCase();
  const map: Record<string, string> = {
    marketing: "marketing",
    programação: "programacao",
    programacao: "programacao",
    "banco de dados": "banco_dados",
    produtividade: "produtividade",
    liderança: "lideranca",
    lideranca: "lideranca",
    design: "design",
    negócios: "negocios",
    negocios: "negocios",
    tecnologia: "tecnologia",
    "tecnologia e carreira": "tecnologia",
    carreira: "tecnologia",
  };
  for (const k of Object.keys(map)) {
    if (t.includes(k)) return map[k];
  }
  return "outros";
}

function guessDifficulty(raw: string): string {
  const t = raw.toLowerCase();
  if (/iniciant/i.test(t)) return "iniciante";
  if (/intermedi/i.test(t)) return "intermediario";
  if (/avanç|avan/i.test(t)) return "avancado";
  return "iniciante";
}

function extractHours(raw: string): number {
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|h\b)/i);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")));
  const n = raw.match(/\d+/);
  return n ? parseInt(n[0], 10) : 4;
}

function normalizeParagraphs(text: string): string {
  const lines = text.split("\n").map((l) => l.trim());
  const out: string[] = [];
  let buffer: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (buffer.length) {
        out.push(buffer.join(" "));
        buffer = [];
      }
      continue;
    }
    buffer.push(line);
  }
  if (buffer.length) out.push(buffer.join(" "));
  return out.filter(Boolean).join("\n\n");
}

// ============================================================================
// Parsing de questões (quizzes) — formato robusto
// ============================================================================

const ALT_LINE_RE = /^\s*([A-Da-d])\s*[\.\)\-]\s*(.*)$/;

/**
 * Insere quebras de linha antes de cada alternativa "A) ... B) ... C) ... D)"
 * que esteja grudada na mesma linha.
 *
 * - Para "B)" / "C)" / "D)": parêntese é raríssimo em texto normal,
 *   então quebramos sempre que aparecer uma alternativa válida (precedida
 *   por algo que não seja `A-D` colado: evita "AB)" virar duas).
 * - Para "B." / "C." / "D.": só quebra se o caractere anterior NÃO for
 *   letra maiúscula (evita siglas como "I.A.", "P.A.C.").
 */
function isolateAlternatives(text: string): string {
  let out = text;
  // Caso 1a: "A)" — preservamos com lookbehind. "A)" pode aparecer dentro
  // de uma palavra/sigla com referências (ex.: "IA)", "(A)" como citação,
  // "ChatGPT (A)"). Apenas quebramos quando A NÃO está precedido de letra.
  out = out.replace(/(?<![A-Za-z])A\)\s*/g, "\nA) ");
  // Caso 1b: "B)", "C)", "D)" — em texto natural português, é EXTREMAMENTE
  // raro encontrar essas letras seguidas de ) no meio de uma palavra. Por
  // isso quebramos sempre que o `)` for seguido de espaço ou conteúdo,
  // independentemente do que vier antes (cobrindo "técnicoB)", "reuniõesD)" etc.).
  out = out.replace(/([B-D])\)\s*/g, "\n$1) ");
  // Caso 2: "A.", "B.", "C.", "D." — só quebra quando NÃO está dentro de
  // uma sigla (evita "P.A.C.", "I.A.", "M.B.A.", "P.B.X."). Para isso o
  // caractere imediatamente anterior não pode ser letra NEM ponto.
  out = out.replace(/(?<![A-Za-z\.])([A-D])\.\s+/g, "\n$1. ");
  return out.replace(/\n{3,}/g, "\n\n");
}

/**
 * Limpa um enunciado removendo prefixos de numeração e marcadores comuns.
 */
function cleanStatement(raw: string): string {
  return raw
    .replace(/__CORRECT__/g, "")
    .replace(/^\s*Quiz\s*\d*\s*[:\-]?\s*/i, "")
    .replace(/^\s*Pergunta\s*[:\-]?\s*/i, "")
    .replace(/^\s*\d+\s*[-.\)]\s*(?:Quiz\s*[:\-]?\s*)?/i, "")
    .replace(/^\s*[-:•·]\s*/, "")
    .replace(/^\s*Pergunta\s*[:\-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parser robusto de questões em texto livre. Identifica os "blocos" de
 * alternativas (A-D) e atribui cada quartet à pergunta imediatamente
 * anterior. Aceita várias variações de marcador (`A)`, `A.`, `A-`).
 *
 * Quando o texto contém numeração explícita ("1. enunciado", "2. ..."),
 * processa cada bloco numerado isoladamente — assim instruções gerais e
 * cabeçalhos entre questões não bagunçam a detecção.
 */
function parseQuestionsFromText(rawText: string): ParsedQuestion[] {
  if (!rawText) return [];

  // Tenta dividir por numeração explícita no início de cada questão.
  // Padrão: "1.", "2.", "10.", "1-", "1)", possivelmente precedido por
  // "Questão N." — sempre no início de linha (após \n) ou início do texto.
  const numberedSplit = rawText.split(
    /(?=(?:^|\n)\s*(?:Quest[aã]o\s+)?\d{1,2}\s*[\.\-\)]\s+(?:[A-Z]|"|'|\u201C))/g
  );
  if (numberedSplit.length >= 3) {
    const allQuestions: ParsedQuestion[] = [];
    for (const block of numberedSplit) {
      // Confere se o bloco tem ao menos 3 alternativas plausíveis
      const altACount = (block.match(/(?:^|\n)\s*A\s*[\)\.\-]/g) || []).length;
      const altDCount = (block.match(/(?:^|\n)\s*D\s*[\)\.\-]/g) || []).length;
      const altACountInline = (block.match(/(?<![A-D])A\s*[\)\.\-]\s+/g) || [])
        .length;
      if (altACount + altACountInline === 0 && altDCount === 0) continue;
      const qs = parseQuestionsFromAlternativeBlock(block);
      allQuestions.push(...qs);
    }
    if (allQuestions.length > 0) return allQuestions;
  }
  return parseQuestionsFromAlternativeBlock(rawText);
}

function parseQuestionsFromAlternativeBlock(rawText: string): ParsedQuestion[] {
  if (!rawText) return [];
  const prepared = isolateAlternatives(rawText);
  const lines = prepared
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const questions: ParsedQuestion[] = [];
  let pendingStatement: string[] = [];
  let alts: Record<"A" | "B" | "C" | "D", string> = {
    A: "",
    B: "",
    C: "",
    D: "",
  };
  let correct: "A" | "B" | "C" | "D" | null = null;
  let lastLetter: "A" | "B" | "C" | "D" | null = null;

  const finalize = () => {
    const filled = (["A", "B", "C", "D"] as const).filter((k) => alts[k]);
    if (filled.length >= 3) {
      const stmt = cleanStatement(pendingStatement.join(" "));
      if (stmt && stmt.length >= 5) {
        questions.push({
          statement: stmt,
          option_a: alts.A || "—",
          option_b: alts.B || "—",
          option_c: alts.C || "—",
          option_d: alts.D || "—",
          correct_option: correct ?? "A",
        });
      }
    }
    pendingStatement = [];
    alts = { A: "", B: "", C: "", D: "" };
    correct = null;
    lastLetter = null;
  };

  for (const line of lines) {
    const m = line.match(ALT_LINE_RE);
    if (m) {
      const letter = m[1].toUpperCase() as "A" | "B" | "C" | "D";
      let value = m[2].trim();

      // Início de uma alternativa "A" sempre indica nova questão se já
      // havíamos coletado alguma anterior.
      if (letter === "A" && (alts.A || alts.B || alts.C || alts.D)) {
        finalize();
      }

      // Se já preenchemos esta letra antes, é uma nova questão começando.
      if (alts[letter] && letter !== "A") {
        finalize();
        // Esta linha "fora de ordem" provavelmente é A da próxima — descarta.
        if (letter !== "A") continue;
      }

      if (value.includes("__CORRECT__")) {
        value = value.replace(/__CORRECT__/g, "").trim();
        correct = letter;
      }
      alts[letter] = value;
      lastLetter = letter;
      continue;
    }

    // Detector de cabeçalho de nova questão: linhas como
    //  "Quiz 1:", "Quiz 2:", "1- Quiz:", "1. Pergunta:", "Pergunta 3:"
    // Quando aparecem entre alternativas (ou após a última), encerram
    // a questão atual e iniciam o enunciado da próxima.
    const newQuestionStart =
      /^(?:Quiz(?:\s*\d+)?|Pergunta(?:\s*\d+)?|Quest[aã]o(?:\s*\d+)?|\d+\s*[\.\)\-]\s*(?:Quiz|Pergunta|Quest[aã]o))\s*[:\-]/i.test(
        line
      );
    if (newQuestionStart) {
      if (alts.A || alts.B || alts.C || alts.D || pendingStatement.length) {
        finalize();
      }
      pendingStatement.push(line);
      continue;
    }

    // Linha sem padrão de alternativa
    if (lastLetter === "D" && alts.D) {
      // Já temos questão completa: linha pertence à próxima questão
      finalize();
      pendingStatement.push(line);
    } else if (lastLetter && alts[lastLetter]) {
      // Continuação da alternativa anterior
      let txt = line;
      if (txt.includes("__CORRECT__")) {
        txt = txt.replace(/__CORRECT__/g, "").trim();
        correct = lastLetter;
      }
      alts[lastLetter] = (alts[lastLetter] + " " + txt).trim();
    } else {
      // Acumulando enunciado da questão atual
      pendingStatement.push(line);
    }
  }
  finalize();

  return questions;
}

/**
 * Parser de "fallback": tenta extrair questões mesmo quando não há
 * marcadores explícitos A/B/C/D — quando só há listas de 4 itens após
 * uma pergunta. Útil para blocos onde o autor escreveu as alternativas
 * sem letras (raro). Marca a 1ª como correta por padrão (o usuário
 * pode ajustar na pré-visualização).
 */
function parseQuestionsFallback(text: string): ParsedQuestion[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const questions: ParsedQuestion[] = [];
  for (const block of blocks) {
    if (/[A-D]\s*[\)\.\-]/.test(block)) continue; // já tem letras
    const lines = block.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 5) continue;
    const stmtLine = lines[0];
    if (!/[\?\.]$/.test(stmtLine) && stmtLine.length < 10) continue;
    const opts = lines.slice(1, 5);
    if (opts.length < 4) continue;
    const stmt = cleanStatement(stmtLine);
    if (!stmt) continue;
    questions.push({
      statement: stmt,
      option_a: opts[0],
      option_b: opts[1],
      option_c: opts[2],
      option_d: opts[3],
      correct_option: "A",
    });
  }
  return questions;
}

// ============================================================================
// Detecção de submódulos
// ============================================================================

const SUBMODULE_HEADING_RE =
  /^\s*(?:[^:\n]{0,80})?Subm[óo]dulo\b[^\n:]{0,200}:/i;

const PROVA_FINAL_RE =
  /Prova\s+Final|Avalia[çc][aã]o\s+Final|Conclus[aã]o\s+Final|Avalia[çc][aã]o\s+Geral|Quest[oõ]es\s+Finais|Reflex[aã]o\s+Final|Considera[çc][õo]es\s+Finais|Atividade\s+Final/i;

// Marcador global de prova/avaliação final que pode aparecer DENTRO do
// bloco do último módulo (formato em que o autor não usa "Submódulo" e
// emenda a prova final no fim do texto). Cobre variações como:
//   "Prova Final", "Prova -", "Prova:", "Prova" sozinho na linha
//   "Conclusão Final", "Avaliação Final", "Avaliação Geral",
//   "Avaliação do Curso", "Reflexão Final", "Atividade Final",
//   "Considerações Finais", "Questões Finais"
// Sempre exige começo de linha para reduzir falsos positivos como a
// frase "fizemos uma prova final na semana passada".
const FINAL_EXAM_BOUNDARY_RE =
  /(?:^|\n)\s*(?:Prova\s+Final|Conclus[aã]o\s+Final|Avalia[çc][aã]o\s+(?:Final|Geral|do\s+Curso)|Reflex[aã]o\s+Final|Considera[çc][õo]es\s+Finais|Atividade\s+Final|Quest[oõ]es\s+Finais|Prova\s*[-–—:]|Prova\s*$)/im;

interface SubmoduleHeading {
  raw: string;
  title: string;
  isQuiz: boolean;
  isProvaFinal: boolean;
  lineIndex: number;
  /**
   * Conteúdo extra que estava na MESMA linha do heading, depois do `:`
   * do título. Ex.: "Submódulo Quiz: Vamos praticar!1- Quiz: Qual..."
   * → o título é "Vamos praticar!" e o `inlineContent` é "1- Quiz: Qual...".
   */
  inlineContent: string;
}

/**
 * Identifica todos os headings de submódulo dentro de um bloco de texto.
 * Cada heading deve estar em uma única linha curta (< 200 chars) e
 * conter a palavra "Submódulo" próxima ao início.
 */
function findSubmoduleHeadings(text: string): SubmoduleHeading[] {
  const lines = text.split("\n");
  const headings: SubmoduleHeading[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || line.length > 250) continue;
    if (!SUBMODULE_HEADING_RE.test(line)) continue;
    // Extrai o título usando o PRIMEIRO ":" após a palavra "Submódulo"
    // (assim "Submódulo - artigo: Prova Final: Produtividade com IA"
    //  vira título "Prova Final: Produtividade com IA").
    const subMatch = line.match(/Subm[óo]dulo\b[^:\n]*:/i);
    let titleAndExtra = "";
    if (subMatch && typeof subMatch.index === "number") {
      const afterColonStart = subMatch.index + subMatch[0].length;
      titleAndExtra = line.slice(afterColonStart).trim();
    } else {
      const colonIdx = line.indexOf(":");
      titleAndExtra = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : "";
    }

    // Se na MESMA linha já houver início de questão (ex.:
    // "Vamos praticar!1- Quiz: Qual..." ou "Vamos praticar!Quiz 1: ..."),
    // separamos o título do conteúdo inline.
    let title = titleAndExtra;
    let inlineContent = "";
    const inlineQuizRe =
      /(?:^|\b)(\d+\s*[-.)]\s*Quiz\s*[:\-]|Quiz\s*\d+\s*[:\-]|Quiz\s*[:\-])/i;
    const inlineMatch = titleAndExtra.match(inlineQuizRe);
    if (inlineMatch && typeof inlineMatch.index === "number") {
      title = titleAndExtra.slice(0, inlineMatch.index).trim() || "Quiz";
      inlineContent = titleAndExtra.slice(inlineMatch.index).trim();
    }

    // Quando o título tem "palavraGrudada" (transição CamelCase abrupta
    // depois dos primeiros 20 chars), corta no ponto da fronteira para
    // mover o resto pro conteúdo. Ex.: "Rotinas otimizadas com
    // IAAutomatizando Tarefas..." → título "Rotinas otimizadas com IA",
    // resto vai pro inlineContent.
    if (title.length > 60) {
      const cutRe = /[a-z][A-Z]|[A-Z](?=[A-Z][a-z])/;
      const cut = title.slice(20).search(cutRe);
      if (cut >= 0) {
        const cutAt = 20 + cut + 1;
        const extra = title.slice(cutAt).trim();
        title = title.slice(0, cutAt).trim();
        if (extra) {
          inlineContent = extra + (inlineContent ? "\n" + inlineContent : "");
        }
      }
    }

    const isProvaFinal =
      PROVA_FINAL_RE.test(title) || PROVA_FINAL_RE.test(line);
    const headingNorm = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isQuiz =
      /\bQuiz\b/i.test(headingNorm) || /\bQuiz\b/i.test(inlineContent);
    headings.push({
      raw: line.trim(),
      title: title || line.trim(),
      isQuiz,
      isProvaFinal,
      lineIndex: i,
      inlineContent,
    });
  }
  return headings;
}

/**
 * Decide o tipo de um submódulo baseado no heading + conteúdo.
 * Se o heading diz "Quiz" → quiz.
 * Se o heading não diz nada mas o conteúdo tem 1+ quartet com ✅ ou
 * 2+ quartets A-B-C-D, promove para quiz.
 */
function decideSubmoduleType(
  heading: SubmoduleHeading,
  content: string
): ParsedSubmoduleType {
  if (heading.isQuiz) return "quiz";
  // Heurística: se o conteúdo tem múltiplos quartets, é provavelmente quiz
  const altACount = (content.match(/(?:^|\n)\s*A\s*[\)\.\-]/g) || []).length;
  const correctMarkers = (content.match(/__CORRECT__/g) || []).length;
  if (altACount >= 2) return "quiz";
  if (altACount >= 1 && correctMarkers >= 1) return "quiz";
  return "article";
}

// ============================================================================
// Gabarito
// ============================================================================

/**
 * Parseia uma seção "Gabarito" e retorna mapa número → letra correta.
 *
 * Formatos aceitos:
 *  - "1. B" / "1) B" / "Questão 1: B" (inline)
 *  - "Gabarito da Prova\n B \n C \n B \n ..." (uma letra por linha,
 *    correspondendo às questões 1, 2, 3, ... na ordem)
 *  - Tabela quebrada: número e letra em linhas próximas
 */
function parseAnswerKey(text: string): Map<number, "A" | "B" | "C" | "D"> {
  const result = new Map<number, "A" | "B" | "C" | "D">();
  if (!text) return result;

  // Padrão 1: inline "N. X" / "N) X"
  const inline =
    /(?:^|\n)\s*(?:Quest[aã]o\s+)?(\d{1,2})\s*[\.\)\-:]\s*([A-D])\b/gi;
  let m;
  while ((m = inline.exec(text)) !== null) {
    const num = parseInt(m[1], 10);
    if (!result.has(num)) {
      result.set(num, m[2].toUpperCase() as "A" | "B" | "C" | "D");
    }
  }
  if (result.size > 0) return result;

  // Padrão 2: lista de letras isoladas (A, B, C, ...) na ordem.
  // Considera linhas que tenham SOMENTE uma letra A-D (com possível
  // pontuação/parênteses) como respostas sequenciais.
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let order = 1;
  for (const line of lines) {
    const lone = line.match(/^([A-D])(?:\s*[\)\.\-]|\s|$|\(.*\))/);
    if (lone) {
      result.set(order, lone[1].toUpperCase() as "A" | "B" | "C" | "D");
      order += 1;
    }
  }
  if (result.size > 0) return result;

  // Padrão 3: tabela quebrada — número em uma linha, letra em outra próxima.
  for (let i = 0; i < lines.length; i++) {
    const numMatch = lines[i].match(/^(\d{1,2})$/);
    if (!numMatch) continue;
    const num = parseInt(numMatch[1], 10);
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const letterMatch = lines[j].match(/^([A-D])\b/);
      if (letterMatch) {
        if (!result.has(num)) {
          result.set(
            num,
            letterMatch[1].toUpperCase() as "A" | "B" | "C" | "D"
          );
        }
        break;
      }
    }
  }
  return result;
}

// ============================================================================
// Parser principal
// ============================================================================

/**
 * Parseia um curso a partir do texto bruto extraído de um Word/.docx.
 *
 * Suporta:
 *  - Cabeçalho com Título / Descrição / Duração / Categoria / Dificuldade
 *  - Módulos numerados ("Módulo N: ...")
 *  - Submódulos dentro de cada módulo (Artigo / Quiz), com heading
 *    "Submódulo X - Artigo: ..." ou "Submódulo Quiz: ..."
 *  - Quizzes com formato variado (Quiz N:, 1- Quiz:, A) ... ✅, etc.)
 *  - Prova final como submódulo OU como seção independente
 *  - "Gabarito" com formatos diversos (lista de letras, inline, tabela)
 *
 * Cada submódulo se torna uma **atividade** no curso (article ou quiz).
 */
export function parseCourseText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const sectionsFound: string[] = [];
  const sanitized = sanitize(rawText);

  // -------------------------------------------------------------
  // 1. Isolar gabarito (lista de respostas), se existir
  // -------------------------------------------------------------
  const answerKeyMatch = sanitized.match(
    /(?:^|\n)\s*Gabarito(?:\s+(?:Oficial|da\s+Prova|Final))?[\s:]*(?:\n|$)/i
  );
  let textWithoutAnswerKey = sanitized;
  let answerKey = new Map<number, "A" | "B" | "C" | "D">();
  if (answerKeyMatch && typeof answerKeyMatch.index === "number") {
    const before = sanitized.slice(0, answerKeyMatch.index);
    const keyText = sanitized.slice(answerKeyMatch.index);
    answerKey = parseAnswerKey(keyText);
    textWithoutAnswerKey = before;
  }

  // -------------------------------------------------------------
  // 2. Extrair cabeçalho
  // -------------------------------------------------------------
  const NEXT_LABEL =
    "(?=T[íi]tulo\\s*:|Pequena\\s+Descri[çc][aã]o\\s*:|Descri[çc][aã]o\\s+Detalhada\\s*:|Descri[çc][aã]o\\s*:|O\\s+que\\s+(?:voc[êe]\\s+)?ir[áa]\\s+aprender\\s*:|Dura[çc][aã]o\\s*:|M[óo]dulos\\s*:|Categoria\\s*:|Dificuldade\\s*:|M[óo]dulo\\s+\\d+\\s*:|$)";

  const extractField = (labelRegex: string): string => {
    const re = new RegExp(
      `${labelRegex}\\s*:\\s*([\\s\\S]*?)${NEXT_LABEL}`,
      "i"
    );
    const m = textWithoutAnswerKey.match(re);
    return m ? cleanSpaces(m[1]) : "";
  };

  const title =
    extractField("T[íi]tulo") ||
    textWithoutAnswerKey.split("\n").find((l) => l.trim().length > 10)?.trim() ||
    "Curso sem título";

  const shortDescription =
    extractField("Pequena\\s+Descri[çc][aã]o") ||
    extractField("Descri[çc][aã]o\\s+curta") ||
    "";

  const longDescription =
    extractField("Descri[çc][aã]o\\s+Detalhada") ||
    extractField("Descri[çc][aã]o") ||
    "";

  const learningGoals = extractField(
    "O\\s+que\\s+(?:voc[êe]\\s+)?ir[áa]\\s+aprender"
  );

  const workloadHours = extractHours(extractField("Dura[çc][aã]o") || "4");
  const category = guessCategory(extractField("Categoria") || "Outros");
  const difficulty = guessDifficulty(extractField("Dificuldade") || "Iniciante");

  sectionsFound.push("Cabeçalho");

  // -------------------------------------------------------------
  // 2.5 Isolar a prova final que aparece como SEÇÃO INDEPENDENTE
  // -------------------------------------------------------------
  // Se houver um marcador de prova/avaliação final (ex.: "Prova -",
  // "Conclusão Final:", "Prova Final") posicionado depois de pelo menos
  // um "Módulo N:", separamos o texto em duas partes para que essa
  // seção não seja absorvida como conteúdo do último módulo.
  let preExtractedFinalExam = "";
  {
    const firstModuleMatch = textWithoutAnswerKey.match(
      /(?:^|\n)\s*M[óo]dulo\s+\d+\s*:/i
    );
    if (firstModuleMatch && typeof firstModuleMatch.index === "number") {
      const firstModulePos = firstModuleMatch.index;
      // Procuramos o marcador APÓS o início do primeiro módulo, varrendo
      // o texto da frente para trás para ignorar menções acidentais à
      // palavra "prova" no corpo de algum módulo. Para isso pegamos o
      // ÚLTIMO match cujo conteúdo seguinte tenha pelo menos uma
      // questão (numerada ou com A/B/C/D).
      const re = new RegExp(FINAL_EXAM_BOUNDARY_RE.source, "gim");
      let candidate: { idx: number; matchedText: string } | null = null;
      let mEx: RegExpExecArray | null;
      while ((mEx = re.exec(textWithoutAnswerKey)) !== null) {
        if (mEx.index < firstModulePos) continue;
        const after = textWithoutAnswerKey.slice(mEx.index);
        // Só consideramos se o trecho a seguir contiver alternativas A/B/C/D
        // ou questões numeradas — caso contrário pode ser uma referência
        // dentro de um módulo (ex.: "Conclusão Final:" como subtítulo).
        const hasAlts = /\n\s*[A-D][\.\)\-]\s+/.test(after);
        const hasNumbered = /(?:^|\n)\s*\d{1,2}\s*[\.\)\-]\s+\S/.test(after);
        if (!hasAlts && !hasNumbered) continue;
        // Preferimos o ÚLTIMO marcador válido (mais externo).
        candidate = { idx: mEx.index, matchedText: mEx[0] };
      }
      if (candidate) {
        preExtractedFinalExam = textWithoutAnswerKey.slice(candidate.idx);
        textWithoutAnswerKey = textWithoutAnswerKey.slice(0, candidate.idx);
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Localizar onde começa cada módulo
  // -------------------------------------------------------------
  // Captura "Módulo N: Título" parando o título antes de outro
  // "Módulo X:" grudado na mesma linha (caso comum: linha-sumário com
  // todos os módulos enfileirados sem quebra).
  const moduleRegex =
    /(?:^|\n)\s*M[óo]dulo\s+(\d+)\s*:\s*((?:(?!\s*M[óo]dulo\s+\d+\s*:)[^\n])+)/gi;
  const matches: { index: number; num: number; title: string }[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = moduleRegex.exec(textWithoutAnswerKey)) !== null) {
    let modTitle = cleanSpaces(mm[2]);
    // Se o título é muito longo, provavelmente o texto seguinte está
    // grudado sem espaço (ex.: "IAChegamos..." onde "Chegamos" é o
    // primeiro parágrafo do módulo). Corta na primeira transição
    // CamelCase abrupta (lowercase → uppercase) após 25 chars.
    if (modTitle.length > 80) {
      // Procura uma transição "fronteira de palavra grudada":
      //  - lower→upper (ex.: "produtoConteúdo")
      //  - upper→upper+lower (ex.: "IAChegamos", sigla seguida de palavra)
      const cutRe = /[a-z][A-Z]|[A-Z](?=[A-Z][a-z])/;
      const cut = modTitle.slice(20).search(cutRe);
      if (cut >= 0) {
        modTitle = modTitle.slice(0, 20 + cut + 1).trim();
      }
    }
    if (modTitle.length > 200) modTitle = modTitle.slice(0, 197) + "...";
    matches.push({ index: mm.index, num: parseInt(mm[1], 10), title: modTitle });
  }

  // Filtra ocorrências de "sumário" — quando vários módulos aparecem
  // muito próximos (< 200 chars entre eles, em geral porque foram
  // listados em uma única linha sem quebra). Mantém só matches cujo
  // bloco até o próximo match (qualquer num) tenha tamanho razoável.
  const matchesWithSize = matches.map((m, i) => {
    const next = matches[i + 1];
    const size = next
      ? next.index - m.index
      : textWithoutAnswerKey.length - m.index;
    return { ...m, sizeToNext: size };
  });
  const filteredMatches = matchesWithSize.filter((m, i) => {
    // Mantém o último sempre
    if (i === matchesWithSize.length - 1) return true;
    // Descarta se o próximo está MUITO próximo (provável sumário)
    return m.sizeToNext >= 300;
  });

  // Para cada número de módulo, mantém a ocorrência cuja porção seguinte
  // (até o próximo módulo) é a maior — assim ignoramos um sumário inicial.
  const perNum: Map<number, { idx: number; size: number; title: string }> =
    new Map();
  for (const mEntry of filteredMatches) {
    const nextModule = filteredMatches.find(
      (x) => x.index > mEntry.index && x.num !== mEntry.num
    );
    const size =
      (nextModule?.index ?? textWithoutAnswerKey.length) - mEntry.index;
    const existing = perNum.get(mEntry.num);
    if (!existing || size > existing.size) {
      perNum.set(mEntry.num, {
        idx: mEntry.index,
        size,
        title: mEntry.title,
      });
    }
  }

  const moduleEntries = [...perNum.entries()].sort((a, b) => a[0] - b[0]);

  const modules: ParsedModule[] = [];
  let externalFinalExamText = "";

  for (let i = 0; i < moduleEntries.length; i++) {
    const [num, info] = moduleEntries[i];
    const start = info.idx;
    const end =
      i + 1 < moduleEntries.length
        ? moduleEntries[i + 1][1].idx
        : textWithoutAnswerKey.length;
    let block = textWithoutAnswerKey.slice(start, end);
    block = block.replace(/^\s*M[óo]dulo\s+\d+\s*:\s*[^\n]+/i, "").trim();

    const submodules = extractSubmodulesFromBlock(block, num, info.title);

    // Verifica se algum submódulo é "Prova Final" — se sim, retira
    // do módulo para virar a prova final do curso.
    const provaIdx = submodules.findIndex((s) =>
      PROVA_FINAL_RE.test(s.title)
    );
    if (provaIdx >= 0) {
      const prova = submodules.splice(provaIdx, 1)[0];
      // Recompõe texto da prova final para reuso do parser de questões
      const provaText =
        prova.type === "quiz" && prova.questions.length > 0
          ? ""
          : prova.content;
      externalFinalExamText =
        externalFinalExamText +
        "\n\n" +
        (prova.questions.length > 0
          ? prova.questions
              .map(
                (q, idx) =>
                  `${idx + 1}. ${q.statement}\nA) ${q.option_a}\nB) ${q.option_b}\nC) ${q.option_c}\nD) ${q.option_d}`
              )
              .join("\n\n")
          : provaText);
    }

    if (submodules.length > 0) {
      modules.push({
        index: num,
        title: info.title,
        submodules,
      });
    }
  }

  if (modules.length === 0) {
    warnings.push(
      "Nenhum módulo foi detectado. Os módulos precisam começar com 'Módulo N: Título'."
    );
  } else {
    sectionsFound.push(`${modules.length} módulo(s)`);
    const totalSubmodules = modules.reduce(
      (s, m) => s + m.submodules.length,
      0
    );
    const articleCount = modules.reduce(
      (s, m) => s + m.submodules.filter((sm) => sm.type === "article").length,
      0
    );
    const quizCount = modules.reduce(
      (s, m) => s + m.submodules.filter((sm) => sm.type === "quiz").length,
      0
    );
    sectionsFound.push(
      `${totalSubmodules} submódulos (${articleCount} artigo(s), ${quizCount} quiz(zes))`
    );
  }

  // Avisos sobre possíveis questões perdidas em quizzes (autor pode ter
  // esquecido de marcar as alternativas com A/B/C/D).
  for (const mod of modules) {
    for (const sub of mod.submodules) {
      if (sub.type !== "quiz") continue;
      // Reusa o conteúdo bruto se houver, ou o texto do quiz para detectar
      // o número de marcadores explícitos.
      const possibleQs = sub.questions.length;
      // Quantos marcadores de questão há no título (inlineContent já
      // foi consumido). Usamos o título do submódulo como dica:
      // ex.: módulos com "(5 questões)" são improváveis no .docx, então
      // usamos uma análise simples: se o quiz tem 1 questão mas o autor
      // claramente intencionava várias (não temos como saber sem
      // re-analisar), só avisamos quando 0 questões foram detectadas.
      if (possibleQs === 0) {
        warnings.push(
          `Módulo ${mod.index} · Quiz "${sub.title}": nenhuma questão pôde ` +
            `ser extraída. Verifique se as alternativas usam 'A) ... B) ... ` +
            `C) ... D) ...' e adicione manualmente se necessário.`
        );
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Detectar prova final tradicional (fora de submódulos)
  // -------------------------------------------------------------
  let finalExam: ParsedFinalExam | null = null;

  // Busca marcador clássico fora dos módulos (ex: "Prova Final" como
  // seção independente após o último módulo). Inclui o texto que pode
  // ter sido pré-extraído na etapa 2.5.
  const lastModuleEnd =
    moduleEntries.length > 0
      ? moduleEntries[moduleEntries.length - 1][1].idx +
        moduleEntries[moduleEntries.length - 1][1].size
      : 0;
  const tail =
    textWithoutAnswerKey.slice(lastModuleEnd) +
    (preExtractedFinalExam ? "\n\n" + preExtractedFinalExam : "");

  let provaTitle = "Prova Final";
  let provaText = externalFinalExamText.trim();
  const FINAL_MARKER =
    /(?:^|\n)\s*((?:Conclus[aã]o\s+Final|Avalia[çc][aã]o\s+(?:Geral|Final|do\s+Curso)|Prova\s+Final|Prova\s*[:\-–—]|Prova\s*$|Reflex[aã]o\s+Final|Considera[çc][õo]es\s+Finais|Atividade\s+Final|Quest[oõ]es\s+Finais)[^\n]*)/im;
  const finalMatch = tail.match(FINAL_MARKER);
  if (finalMatch) {
    provaTitle = finalMatch[1].trim().replace(/[\s\-–—:]+$/, "") || "Prova Final";
    provaText = (provaText + "\n\n" + tail.slice(finalMatch.index!)).trim();
  } else if (preExtractedFinalExam.trim()) {
    provaText = (provaText + "\n\n" + preExtractedFinalExam).trim();
  }

  if (provaText) {
    const questions = parseQuestionsFromText(provaText);
    const fallback =
      questions.length === 0 ? parseQuestionsFallback(provaText) : [];
    const all = questions.length > 0 ? questions : fallback;

    // Aplica gabarito se houver
    if (answerKey.size > 0) {
      all.forEach((q, idx) => {
        const fromKey = answerKey.get(idx + 1);
        if (fromKey) q.correct_option = fromKey;
      });
    }

    if (all.length > 0) {
      finalExam = {
        title: provaTitle,
        questions: all,
      };
      sectionsFound.push(
        `Prova final (${all.length} questões${
          answerKey.size ? ", gabarito aplicado" : ""
        })`
      );
    } else {
      warnings.push(
        "A seção de prova final foi encontrada, mas nenhuma questão pôde ser extraída."
      );
    }
  } else {
    warnings.push(
      "Nenhuma seção de prova final detectada (procuramos 'Prova Final', 'Conclusão Final', 'Avaliação Final', etc.)."
    );
  }

  return {
    course: {
      title,
      shortDescription,
      description: longDescription || shortDescription || title,
      workloadHours,
      category,
      difficulty,
      learningGoals,
      modules,
      finalExam,
    },
    diagnostic: {
      sectionsFound,
      warnings,
    },
  };
}

/**
 * Extrai submódulos de um bloco de texto de módulo. Caso não encontre
 * headings explícitos, cria um submódulo article único + tenta detectar
 * Quiz tradicional ao final (compatibilidade com formato antigo).
 */
function extractSubmodulesFromBlock(
  block: string,
  moduleNum: number,
  moduleTitle: string
): ParsedSubmodule[] {
  const headings = findSubmoduleHeadings(block);
  const submodules: ParsedSubmodule[] = [];

  if (headings.length === 0) {
    // Compatibilidade com formato antigo: tudo é article, e se houver
    // "Quiz:" no fim, vira um submódulo quiz separado.
    return parseLegacyModuleBlock(block, moduleNum, moduleTitle);
  }

  // Texto antes do 1º heading vira um submódulo "Introdução" se for grande
  const lines = block.split("\n");
  const firstHeadingPos = headings[0].lineIndex;
  const introText = lines.slice(0, firstHeadingPos).join("\n").trim();
  if (introText.length > 80) {
    submodules.push({
      type: "article",
      title: `Introdução — Módulo ${moduleNum}`,
      content: normalizeParagraphs(introText),
      questions: [],
    });
  }

  // Para cada heading, pega o texto até o próximo heading (ou fim do bloco)
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const startLine = h.lineIndex + 1;
    const endLine =
      i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
    const restLines = lines.slice(startLine, endLine).join("\n");
    const content = (
      h.inlineContent ? h.inlineContent + "\n" + restLines : restLines
    ).trim();
    const detectedType = decideSubmoduleType(h, content);

    // Limpa título do heading (remove __CORRECT__ etc.)
    const cleanTitle =
      h.title.replace(/__CORRECT__/g, "").trim() ||
      `Submódulo ${i + 1} — Módulo ${moduleNum}`;

    if (h.isProvaFinal) {
      // Marca este submódulo como prova final, mantendo o conteúdo bruto
      // para a função-pai isolar e parsear lá.
      submodules.push({
        type: "quiz",
        title: `Prova Final: ${cleanTitle.replace(/^Prova\s+Final\s*:?\s*/i, "")}`,
        content: content,
        questions: [],
      });
    } else if (detectedType === "quiz") {
      let questions = parseQuestionsFromText(content);
      if (questions.length === 0) {
        questions = parseQuestionsFallback(content);
      }
      submodules.push({
        type: "quiz",
        title: cleanTitle,
        content: "",
        questions,
      });
    } else {
      submodules.push({
        type: "article",
        title: cleanTitle,
        content: normalizeParagraphs(content),
        questions: [],
      });
    }
  }

  return submodules;
}

/**
 * Compat. com formato antigo: módulo sem submódulos explícitos.
 * Cria um article com todo o conteúdo + tenta extrair um quiz no final.
 */
function parseLegacyModuleBlock(
  block: string,
  moduleNum: number,
  moduleTitle: string
): ParsedSubmodule[] {
  const submodules: ParsedSubmodule[] = [];

  // Busca o início de uma seção de quiz ao final do módulo
  const quizSectionMatch = block.match(
    /(?:Pronto\s+para\s+testar[\s\S]{0,300}?)?\bQuiz(?:\s*\d+)?\s*[:\-]/i
  );

  let articleText = block;
  let quizText = "";

  if (quizSectionMatch && typeof quizSectionMatch.index === "number") {
    articleText = block.slice(0, quizSectionMatch.index).trim();
    quizText = block.slice(quizSectionMatch.index).trim();
  }

  if (articleText.trim()) {
    submodules.push({
      type: "article",
      title: `Módulo ${moduleNum}: ${moduleTitle}`,
      content: normalizeParagraphs(articleText),
      questions: [],
    });
  }

  if (quizText.trim()) {
    let questions = parseQuestionsFromText(quizText);
    if (questions.length === 0) {
      questions = parseQuestionsFallback(quizText);
    }
    if (questions.length > 0) {
      submodules.push({
        type: "quiz",
        title: `Quiz: ${moduleTitle}`,
        content: "",
        questions,
      });
    }
  }

  return submodules;
}

/**
 * Lê um arquivo .docx no browser via mammoth e retorna o texto bruto.
 */
export async function readDocxFile(file: File): Promise<string> {
  const mammoth = (await import("mammoth")).default as unknown as {
    extractRawText: (input: {
      arrayBuffer: ArrayBuffer;
    }) => Promise<{ value: string }>;
  };
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}
