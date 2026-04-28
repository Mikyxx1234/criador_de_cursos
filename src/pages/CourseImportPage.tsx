import { useMemo, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FileDrop } from "@/components/ui/FileDrop";
import { Badge } from "@/components/ui/Badge";

import {
  parseCourseText,
  readDocxFile,
  type ParsedCourse,
  type ParsedModule,
  type ParsedQuestion,
  type ParsedSubmodule,
} from "@/lib/courseParser";
import { CATEGORIES, DIFFICULTY_LEVELS } from "@/types/course";
import { plainTextToHtml } from "@/lib/utils";
import { createCourse } from "@/services/courseService";
import { createActivity } from "@/services/activityService";
import {
  createFinalExamQuestions,
  createQuizQuestions,
} from "@/services/questionService";
import { parseApiError, pingApi } from "@/services/apiClient";
import { RenewTokenModal } from "@/components/auth/RenewTokenModal";
import { AIFormattingPanel } from "@/components/course/AIFormattingPanel";

interface CourseImportPageProps {
  onBackToList: () => void;
  onFinished: (courseId: number) => void;
}

type Step = "input" | "preview" | "importing" | "done";

interface ImportLog {
  type: "info" | "success" | "error";
  message: string;
}

export function CourseImportPage({
  onBackToList,
  onFinished,
}: CourseImportPageProps) {
  const [step, setStep] = useState<Step>("input");
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);

  const [parsed, setParsed] = useState<ParsedCourse | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [price, setPrice] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);

  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [createdCourseId, setCreatedCourseId] = useState<number | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    endpoint: string;
    payload: unknown;
    status?: number;
    response?: unknown;
  } | null>(null);
  const [renewTokenOpen, setRenewTokenOpen] = useState(false);

  const canSubmit =
    parsed &&
    coverImage &&
    parsed.title.trim() &&
    parsed.description.trim() &&
    parsed.modules.length > 0;

  const handleParseText = () => {
    if (!rawText.trim()) {
      toast.error("Cole ou carregue um texto antes de processar.");
      return;
    }
    setParsing(true);
    try {
      const { course, diagnostic } = parseCourseText(rawText);
      setParsed(course);
      setWarnings(diagnostic.warnings);
      setStep("preview");
      toast.success(
        `Detectado: ${diagnostic.sectionsFound.join(" · ") || "nada"}`
      );
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível interpretar o texto.");
    } finally {
      setParsing(false);
    }
  };

  const handleDocxUpload = async (file: File | null) => {
    if (!file) return;
    setParsing(true);
    try {
      const text = await readDocxFile(file);
      setRawText(text);
      toast.success(`Texto extraído de "${file.name}"`);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível ler o arquivo .docx.");
    } finally {
      setParsing(false);
    }
  };

  const updateModule = (index: number, patch: Partial<ParsedModule>) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const modules = [...prev.modules];
      modules[index] = { ...modules[index], ...patch };
      return { ...prev, modules };
    });
  };

  const removeModule = (index: number) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.filter((_, i) => i !== index);
      return { ...prev, modules };
    });
  };

  const updateSubmodule = (
    moduleIdx: number,
    subIdx: number,
    patch: Partial<ParsedSubmodule>
  ) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const modules = [...prev.modules];
      const mod = modules[moduleIdx];
      const submodules = [...mod.submodules];
      submodules[subIdx] = { ...submodules[subIdx], ...patch };
      modules[moduleIdx] = { ...mod, submodules };
      return { ...prev, modules };
    });
  };

  const removeSubmodule = (moduleIdx: number, subIdx: number) => {
    setParsed((prev) => {
      if (!prev) return prev;
      const modules = [...prev.modules];
      const mod = modules[moduleIdx];
      modules[moduleIdx] = {
        ...mod,
        submodules: mod.submodules.filter((_, i) => i !== subIdx),
      };
      return { ...prev, modules };
    });
  };

  const updateFinalQuestion = (
    index: number,
    patch: Partial<ParsedQuestion>
  ) => {
    setParsed((prev) => {
      if (!prev || !prev.finalExam) return prev;
      const questions = [...prev.finalExam.questions];
      questions[index] = { ...questions[index], ...patch };
      return {
        ...prev,
        finalExam: { ...prev.finalExam, questions },
      };
    });
  };

  const removeFinalQuestion = (index: number) => {
    setParsed((prev) => {
      if (!prev || !prev.finalExam) return prev;
      const questions = prev.finalExam.questions.filter((_, i) => i !== index);
      return {
        ...prev,
        finalExam: { ...prev.finalExam, questions },
      };
    });
  };

  const addFinalQuestion = () => {
    setParsed((prev) => {
      if (!prev) return prev;
      const exam = prev.finalExam ?? {
        title: "Prova Final",
        questions: [],
      };
      const questions = [
        ...exam.questions,
        {
          statement: "Nova questão",
          option_a: "",
          option_b: "",
          option_c: "",
          option_d: "",
          correct_option: "A" as const,
        },
      ];
      return {
        ...prev,
        finalExam: { ...exam, questions },
      };
    });
  };

  const pushLog = (log: ImportLog) => {
    setLogs((prev) => [...prev, log]);
  };

  const runImport = async () => {
    if (!parsed || !coverImage) return;
    setStep("importing");
    setLogs([]);
    setProgress(0);
    setDebugInfo(null);

    // Guarda o último payload enviado para, em caso de erro, mostrarmos na tela.
    let lastEndpoint = "";
    let lastPayload: unknown = null;
    const sendActivity = async (
      courseId: number,
      payload: Parameters<typeof createActivity>[1]
    ) => {
      lastEndpoint = `POST /courses/${courseId}/activities`;
      lastPayload = payload;
      console.log("[Import] →", lastEndpoint, payload);
      return createActivity(courseId, payload);
    };

    // Cada submódulo (artigo ou quiz) vira 1 atividade. Para quizzes,
    // contamos +1 step para enviar as questões.
    const allSubmodules = parsed.modules.flatMap((m) =>
      m.submodules.map((s) => ({ mod: m, sub: s }))
    );
    const quizSubmodules = allSubmodules.filter((x) => x.sub.type === "quiz");
    const hasFinal =
      parsed.finalExam && parsed.finalExam.questions.length > 0 ? 1 : 0;
    const totalSteps =
      1 /* course */ +
      allSubmodules.length /* atividade por submódulo */ +
      quizSubmodules.length /* lote de questões por quiz */ +
      hasFinal * 2; /* final_exam + lote de questões */
    setTotal(totalSteps);
    let currentStep = 0;

    const step = (log: ImportLog) => {
      currentStep += 1;
      setProgress(currentStep);
      pushLog(log);
    };

    try {
      // 0. Sanity check de conectividade antes de iniciar o fluxo longo.
      pushLog({ type: "info", message: "Verificando conexão com a API..." });
      const ping = await pingApi();
      if (!ping.ok) {
        pushLog({
          type: "error",
          message:
            `Falha ao acessar a API antes de começar: ${ping.message}. ` +
            `Abra o DevTools (F12) → aba Network e tente novamente para ver a request bloqueada.`,
        });
        setDebugInfo({
          endpoint: "GET /courses (ping)",
          payload: null,
          status: ping.status,
          response: ping.message,
        });
        toast.error("Sem conexão com a API. Veja diagnóstico abaixo.");
        return;
      }
      pushLog({ type: "success", message: "API respondeu — iniciando criação." });

      // 1. Criar curso
      pushLog({ type: "info", message: "Criando curso..." });
      const course = await createCourse({
        title: parsed.title,
        description: parsed.description,
        short_description: parsed.shortDescription || undefined,
        workload: parsed.workloadHours,
        modules_count: parsed.modules.length,
        difficulty_level:
          (parsed.difficulty as "iniciante" | "intermediario" | "avancado") ||
          "iniciante",
        category: (parsed.category as "outros") || "outros",
        price: Number(price) || 0,
        is_active: isActive,
        cover_image: coverImage,
      });
      setCreatedCourseId(course.id);
      step({ type: "success", message: `Curso criado (ID ${course.id})` });

      // 2. Criar cada submódulo (article/quiz) na ordem
      let order = 1;
      for (const mod of parsed.modules) {
        for (const sub of mod.submodules) {
          if (sub.type === "article") {
            pushLog({
              type: "info",
              message: `Criando artigo do Módulo ${mod.index}: "${sub.title}"...`,
            });
            const articleContentHtml = plainTextToHtml(sub.content);
            const created = await sendActivity(course.id, {
              type: "article",
              title: `Módulo ${mod.index}: ${sub.title}`,
              order,
              article: {
                description: parsed.shortDescription || undefined,
                content_richtext: articleContentHtml,
              },
            });
            order += 1;
            step({
              type: "success",
              message: `Artigo criado (atividade ${created.id})`,
            });
          } else {
            // Quiz
            pushLog({
              type: "info",
              message: `Criando quiz do Módulo ${mod.index}: "${sub.title}" (${sub.questions.length} questões)...`,
            });
            const quizActivity = await sendActivity(course.id, {
              type: "quiz",
              title: `Módulo ${mod.index} · Quiz: ${sub.title}`,
              order,
              quiz: {
                description: `Verificação de aprendizado — Módulo ${mod.index}`,
                duration_minutes: 10,
                passing_score: 70,
              },
            });
            order += 1;
            step({
              type: "success",
              message: `Atividade quiz criada (ID ${quizActivity.id}, quiz interno ${quizActivity.quiz?.id})`,
            });

            if (quizActivity.quiz?.id && sub.questions.length > 0) {
              pushLog({
                type: "info",
                message: `Enviando ${sub.questions.length} questão(ões) do quiz...`,
              });
              await createQuizQuestions(
                quizActivity.quiz.id,
                sub.questions.map((q, i) => toQuestionPayload(q, i + 1))
              );
              step({
                type: "success",
                message: `${sub.questions.length} questão(ões) do quiz salvas`,
              });
            } else {
              step({
                type: "info",
                message: `Quiz sem questões — adicione manualmente depois.`,
              });
            }
          }
        }
      }

      // 3. Prova final
      if (parsed.finalExam && parsed.finalExam.questions.length > 0) {
        pushLog({ type: "info", message: `Criando Prova Final...` });
        const finalActivity = await sendActivity(course.id, {
          type: "final_exam",
          title: parsed.finalExam.title || `Prova Final — ${parsed.title}`,
          order: 99,
          final_exam: {
            description: `Avaliação final do curso. Aproveitamento mínimo: 70%.`,
            max_attempts: 3,
            duration_minutes: 60,
            passing_score: 70,
          },
        });
        step({
          type: "success",
          message: `Prova final criada (ID ${finalActivity.id}, exam ${finalActivity.final_exam?.id})`,
        });

        if (finalActivity.final_exam?.id) {
          pushLog({
            type: "info",
            message: `Enviando ${parsed.finalExam.questions.length} questões...`,
          });
          await createFinalExamQuestions(
            finalActivity.final_exam.id,
            parsed.finalExam.questions.map((q, i) =>
              toQuestionPayload(q, i + 1)
            )
          );
          step({
            type: "success",
            message: `${parsed.finalExam.questions.length} questões salvas`,
          });
        }
      }

      pushLog({
        type: "success",
        message: "Tudo pronto! Curso importado com sucesso.",
      });
      toast.success("Curso importado com sucesso!");
      setStep("done");
    } catch (error) {
      const parsedError = parseApiError(error);
      console.error("[Import] Erro:", parsedError);
      console.error("[Import] Último payload:", lastPayload);
      const fieldErrors = parsedError.errors
        ? "\n" +
          Object.entries(parsedError.errors)
            .map(([f, msgs]) => `• ${f}: ${(msgs as string[]).join(", ")}`)
            .join("\n")
        : "";
      pushLog({
        type: "error",
        message: `Falha (HTTP ${parsedError.status ?? "?"}): ${parsedError.message}${fieldErrors}`,
      });
      setDebugInfo({
        endpoint: lastEndpoint || "(desconhecido)",
        payload: lastPayload,
        status: parsedError.status,
        response: parsedError.raw ?? parsedError.message,
      });
      toast.error(
        `Falha na importação. ${parsedError.message}${fieldErrors ? " (veja o painel)" : ""}`
      );
    }
  };

  const availableCategory = useMemo(
    () => [{ value: "", label: "Selecione..." }, ...CATEGORIES],
    []
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="mx-auto max-w-5xl px-4 md:px-8 pt-8">
        <PageHeader
          title="Importar curso de Word / texto"
          subtitle="Cole o texto do seu roteiro ou envie o arquivo .docx. Detectamos automaticamente módulos, quizzes e prova final."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenewTokenOpen(true)}
                icon={<KeyRound className="h-4 w-4" />}
                title="Renovar o token de acesso à API"
              >
                Renovar token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToList}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                Voltar para lista
              </Button>
            </>
          }
        />

        <RenewTokenModal
          open={renewTokenOpen}
          onClose={() => setRenewTokenOpen(false)}
        />

        <div className="mt-8">
          {step === "input" && (
            <InputStep
              rawText={rawText}
              setRawText={setRawText}
              onDocxUpload={handleDocxUpload}
              onParse={handleParseText}
              parsing={parsing}
            />
          )}

          {step === "preview" && parsed && (
            <PreviewStep
              parsed={parsed}
              warnings={warnings}
              coverImage={coverImage}
              setCoverImage={setCoverImage}
              price={price}
              setPrice={setPrice}
              isActive={isActive}
              setIsActive={setIsActive}
              onEditCourse={(patch) =>
                setParsed((prev) => (prev ? { ...prev, ...patch } : prev))
              }
              onEditModule={updateModule}
              onRemoveModule={removeModule}
              onEditSubmodule={updateSubmodule}
              onRemoveSubmodule={removeSubmodule}
              onEditFinalQuestion={updateFinalQuestion}
              onRemoveFinalQuestion={removeFinalQuestion}
              onAddFinalQuestion={addFinalQuestion}
              onBack={() => setStep("input")}
              onSubmit={runImport}
              canSubmit={Boolean(canSubmit)}
              availableCategory={availableCategory}
            />
          )}

          {(step === "importing" || step === "done") && (
            <ImportProgress
              logs={logs}
              current={progress}
              total={total}
              done={step === "done"}
              courseId={createdCourseId}
              debugInfo={debugInfo}
              onBack={onBackToList}
              onOpenCourse={(id) => onFinished(id)}
              onRetry={() => {
                setStep("preview");
                setDebugInfo(null);
                setLogs([]);
                setProgress(0);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function toQuestionPayload(q: ParsedQuestion, order: number) {
  return {
    statement: q.statement,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option.toLowerCase() as "a" | "b" | "c" | "d",
    order,
  };
}

interface InputStepProps {
  rawText: string;
  setRawText: (v: string) => void;
  onDocxUpload: (file: File | null) => void;
  onParse: () => void;
  parsing: boolean;
}

function InputStep({
  rawText,
  setRawText,
  onDocxUpload,
  onParse,
  parsing,
}: InputStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          Ponto de partida
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700 mb-1">
            Formato recomendado do texto:
          </p>
          <pre className="text-xs whitespace-pre-wrap font-mono text-slate-500 leading-relaxed">
{`Título: Nome do curso
Pequena Descrição: resumo curto
Descrição Detalhada: descrição longa
Duração: 4 horas
Categoria: Marketing
Dificuldade: Iniciante

Módulo 1: Introdução
...texto do módulo 1...

Quiz:
Enunciado da pergunta?
A) alternativa
B) alternativa
C) alternativa correta ✅
D) alternativa

Módulo 2: Segundo tópico
...texto...

Conclusão Final
1- Pergunta da prova final?
A) opção
B) opção correta ✅
C) opção
D) opção
2- ...`}
          </pre>
        </div>

        <div className="grid md:grid-cols-[auto,1fr] gap-4 items-start">
          <DocxUploader onChange={onDocxUpload} />
          <Textarea
            label="Ou cole o texto do curso aqui"
            rows={14}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Cole o texto completo do seu curso..."
            hint={`${rawText.length.toLocaleString()} caractere(s)`}
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={onParse}
            loading={parsing}
            disabled={!rawText.trim()}
            icon={<Sparkles className="h-4 w-4" />}
          >
            Processar e pré-visualizar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocxUploader({ onChange }: { onChange: (file: File | null) => void }) {
  return (
    <label className="cursor-pointer inline-flex flex-col items-center justify-center w-56 h-40 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/30 transition-colors text-center p-4">
      <Upload className="h-6 w-6 text-slate-400 mb-2" />
      <p className="text-sm font-medium text-slate-700">Enviar arquivo .docx</p>
      <p className="text-xs text-slate-500 mt-1">
        Vamos extrair o texto automaticamente
      </p>
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

interface PreviewStepProps {
  parsed: ParsedCourse;
  warnings: string[];
  coverImage: File | null;
  setCoverImage: (f: File | null) => void;
  price: string;
  setPrice: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  onEditCourse: (patch: Partial<ParsedCourse>) => void;
  onEditModule: (index: number, patch: Partial<ParsedModule>) => void;
  onRemoveModule: (index: number) => void;
  onEditSubmodule: (
    moduleIdx: number,
    subIdx: number,
    patch: Partial<ParsedSubmodule>
  ) => void;
  onRemoveSubmodule: (moduleIdx: number, subIdx: number) => void;
  onEditFinalQuestion: (index: number, patch: Partial<ParsedQuestion>) => void;
  onRemoveFinalQuestion: (index: number) => void;
  onAddFinalQuestion: () => void;
  onBack: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  availableCategory: { value: string; label: string }[];
}

function PreviewStep({
  parsed,
  warnings,
  coverImage,
  setCoverImage,
  price,
  setPrice,
  isActive,
  setIsActive,
  onEditCourse,
  onEditModule,
  onRemoveModule,
  onEditSubmodule,
  onRemoveSubmodule,
  onEditFinalQuestion,
  onRemoveFinalQuestion,
  onAddFinalQuestion,
  onBack,
  onSubmit,
  canSubmit,
  availableCategory,
}: PreviewStepProps) {
  const totalQuizQuestions = parsed.modules.reduce(
    (acc, m) =>
      acc +
      m.submodules
        .filter((s) => s.type === "quiz")
        .reduce((a, q) => a + q.questions.length, 0),
    0
  );
  const finalCount = parsed.finalExam?.questions.length ?? 0;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-slate-50/85 backdrop-blur border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Badge tone="brand">{parsed.modules.length} módulo(s)</Badge>
            {totalQuizQuestions > 0 && (
              <Badge tone="sky">{totalQuizQuestions} questões em quizzes</Badge>
            )}
            {finalCount > 0 && (
              <Badge tone="success">Prova final · {finalCount} questões</Badge>
            )}
            {!coverImage && (
              <span className="text-xs text-amber-700 font-medium">
                Falta enviar a imagem de capa
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Voltar
            </Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={!canSubmit}
              icon={<Sparkles className="h-4 w-4" />}
            >
              Criar curso + {parsed.modules.length} módulo(s)
              {finalCount > 0 && " + prova final"}
            </Button>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="pt-5">
            <div className="flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900">
                  Revise os pontos abaixo
                </p>
                <ul className="text-sm text-amber-800 space-y-0.5 list-disc ml-5">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            Dados do curso
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Título"
              required
              value={parsed.title}
              onChange={(e) => onEditCourse({ title: e.target.value })}
            />
          </div>
          <Textarea
            label="Descrição curta"
            rows={3}
            value={parsed.shortDescription}
            onChange={(e) =>
              onEditCourse({ shortDescription: e.target.value })
            }
          />
          <Textarea
            label="Descrição longa"
            rows={3}
            value={parsed.description}
            onChange={(e) => onEditCourse({ description: e.target.value })}
          />
          <Input
            label="Carga horária (horas)"
            type="number"
            min={1}
            value={parsed.workloadHours}
            onChange={(e) =>
              onEditCourse({ workloadHours: Number(e.target.value) || 0 })
            }
          />
          <Select
            label="Categoria"
            value={parsed.category}
            onChange={(e) => onEditCourse({ category: e.target.value })}
            options={availableCategory}
          />
          <Select
            label="Dificuldade"
            value={parsed.difficulty}
            onChange={(e) => onEditCourse({ difficulty: e.target.value })}
            options={[
              { value: "", label: "Selecione..." },
              ...DIFFICULTY_LEVELS.map((d) => ({
                value: d.value,
                label: d.label,
              })),
            ]}
          />
          <Input
            label="Preço (R$)"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint="Use 0 para curso gratuito"
          />
          <div className="flex items-center gap-3 mt-5">
            <input
              id="is_active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            <label
              htmlFor="is_active"
              className="text-sm text-slate-700 cursor-pointer"
            >
              Publicar como ativo imediatamente
            </label>
          </div>
          <div className="md:col-span-2">
            <FileDrop
              label="Imagem de capa"
              required
              value={coverImage}
              onChange={setCoverImage}
              hint="Obrigatório para criar o curso via API"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            Estrutura detectada
            <Badge tone="brand">{parsed.modules.length} módulo(s)</Badge>
            {(() => {
              const totalQuizzes = parsed.modules.reduce(
                (acc, m) => acc + m.submodules.filter((s) => s.type === "quiz").length,
                0
              );
              return totalQuizzes > 0 ? (
                <Badge tone="sky">
                  {totalQuizzes} quiz{totalQuizzes > 1 ? "zes" : ""}
                </Badge>
              ) : null;
            })()}
            {parsed.finalExam && parsed.finalExam.questions.length > 0 && (
              <Badge tone="success">
                Prova final · {parsed.finalExam.questions.length} questões
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {parsed.modules.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Nenhum módulo foi detectado. Volte e ajuste o texto para usar o
              padrão <code className="font-mono">Módulo N: Título</code>.
            </div>
          )}

          {parsed.modules.map((mod, i) => {
            const articles = mod.submodules.filter((s) => s.type === "article").length;
            const quizzes = mod.submodules.filter((s) => s.type === "quiz").length;
            return (
              <div
                key={`${mod.index}-${i}`}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="neutral">Módulo {mod.index}</Badge>
                      {articles > 0 && (
                        <Badge tone="brand">
                          {articles} artigo{articles > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {quizzes > 0 && (
                        <Badge tone="sky">
                          {quizzes} quiz{quizzes > 1 ? "zes" : ""}
                        </Badge>
                      )}
                    </div>
                    <Input
                      value={mod.title}
                      onChange={(e) =>
                        onEditModule(i, { title: e.target.value })
                      }
                      placeholder="Título do módulo"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveModule(i)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Remover módulo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {mod.submodules.length === 0 && (
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 text-xs text-amber-800">
                    Nenhum submódulo foi identificado neste módulo.
                  </div>
                )}

                {mod.submodules.map((sub, sIdx) => (
                  <SubmoduleCard
                    key={sIdx}
                    submodule={sub}
                    onChange={(patch) => onEditSubmodule(i, sIdx, patch)}
                    onRemove={() => onRemoveSubmodule(i, sIdx)}
                  />
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Prova final
            <Badge
              tone={
                parsed.finalExam && parsed.finalExam.questions.length > 0
                  ? "success"
                  : "neutral"
              }
            >
              {parsed.finalExam?.questions.length ?? 0} questões
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!parsed.finalExam || parsed.finalExam.questions.length === 0) && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-sm text-amber-900">
              Nenhuma questão de prova final foi detectada automaticamente.
              Você pode adicionar questões manualmente abaixo — sem prova
              final, o curso será importado somente com os módulos e quizzes.
            </div>
          )}

          {(parsed.finalExam?.questions ?? []).map((q, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">Questão {i + 1}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveFinalQuestion(i)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  title="Remover questão"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <QuizPreview
                quiz={q}
                onChange={(updated) => onEditFinalQuestion(i, updated)}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={onAddFinalQuestion}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/40 transition"
          >
            + Adicionar questão da prova final
          </button>
        </CardContent>
      </Card>

    </div>
  );
}

function SubmoduleCard({
  submodule,
  onChange,
  onRemove,
}: {
  submodule: ParsedSubmodule;
  onChange: (patch: Partial<ParsedSubmodule>) => void;
  onRemove: () => void;
}) {
  const isQuiz = submodule.type === "quiz";

  return (
    <div
      className={`rounded-lg border p-3 space-y-3 ${
        isQuiz
          ? "border-sky-200 bg-sky-50/40"
          : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={isQuiz ? "sky" : "brand"}>
              {isQuiz ? "Quiz" : "Artigo"}
            </Badge>
            {isQuiz ? (
              <span className="text-xs text-slate-500">
                {submodule.questions.length} questão
                {submodule.questions.length === 1 ? "" : "ões"}
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                {submodule.content.length.toLocaleString()} caracteres
              </span>
            )}
          </div>
          <Input
            value={submodule.title}
            onChange={(e) => onChange({ title: e.target.value } as Partial<ParsedSubmodule>)}
            placeholder="Título do submódulo"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
          title="Remover submódulo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {submodule.type === "article" ? (
        <Textarea
          rows={6}
          value={submodule.content}
          onChange={(e) =>
            onChange({ content: e.target.value } as Partial<ParsedSubmodule>)
          }
          placeholder="Conteúdo do artigo"
        />
      ) : (
        <div className="space-y-3">
          {submodule.questions.length === 0 && (
            <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-900">
              Nenhuma questão foi extraída automaticamente para este quiz.
              Adicione manualmente abaixo.
            </div>
          )}
          {submodule.questions.map((q, qIdx) => (
            <div key={qIdx} className="relative">
              <div className="absolute -top-2 left-3 z-10 flex items-center gap-1.5">
                <Badge tone="sky">Questão {qIdx + 1}</Badge>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = submodule.questions.filter((_, k) => k !== qIdx);
                  onChange({ questions: next } as Partial<ParsedSubmodule>);
                }}
                className="absolute -top-1 right-2 z-10 p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 bg-white border border-slate-200"
                title="Remover questão"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="pt-3">
                <QuizPreview
                  quiz={q}
                  onChange={(updated) => {
                    const next = [...submodule.questions];
                    next[qIdx] = updated;
                    onChange({ questions: next } as Partial<ParsedSubmodule>);
                  }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const next: ParsedQuestion[] = [
                ...submodule.questions,
                {
                  statement: "Nova questão",
                  option_a: "",
                  option_b: "",
                  option_c: "",
                  option_d: "",
                  correct_option: "A" as const,
                },
              ];
              onChange({ questions: next } as Partial<ParsedSubmodule>);
            }}
            className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/40 transition"
          >
            + Adicionar questão a este quiz
          </button>
        </div>
      )}
    </div>
  );
}

function QuizPreview({
  quiz,
  onChange,
}: {
  quiz: ParsedQuestion;
  onChange: (q: ParsedQuestion) => void;
}) {
  return (
    <div className="rounded-lg bg-brand-50/40 border border-brand-100 p-3 space-y-2">
      <p className="text-xs font-medium text-brand-700 uppercase tracking-wide">
        Quiz do módulo
      </p>
      <Input
        value={quiz.statement}
        onChange={(e) => onChange({ ...quiz, statement: e.target.value })}
        placeholder="Enunciado"
      />
      <div className="grid md:grid-cols-2 gap-2">
        {(["A", "B", "C", "D"] as const).map((letter) => {
          const key = `option_${letter.toLowerCase()}` as
            | "option_a"
            | "option_b"
            | "option_c"
            | "option_d";
          return (
            <div key={letter} className="flex items-center gap-2">
              <input
                type="radio"
                name={`quiz-correct-${quiz.statement.slice(0, 5)}`}
                checked={quiz.correct_option === letter}
                onChange={() => onChange({ ...quiz, correct_option: letter })}
                className="accent-brand-600"
              />
              <Input
                className="flex-1"
                value={quiz[key]}
                onChange={(e) =>
                  onChange({ ...quiz, [key]: e.target.value })
                }
                placeholder={`Alternativa ${letter}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImportProgress({
  logs,
  current,
  total,
  done,
  courseId,
  debugInfo,
  onBack,
  onOpenCourse,
  onRetry,
}: {
  logs: ImportLog[];
  current: number;
  total: number;
  done: boolean;
  courseId: number | null;
  debugInfo: {
    endpoint: string;
    payload: unknown;
    status?: number;
    response?: unknown;
  } | null;
  onBack: () => void;
  onOpenCourse: (id: number) => void;
  onRetry: () => void;
}) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  const hasError = logs.some((l) => l.type === "error");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {done && !hasError ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : hasError ? (
            <AlertCircle className="h-5 w-5 text-rose-600" />
          ) : (
            <Loader2 className="h-5 w-5 text-brand-600 animate-spin" />
          )}
          {done
            ? hasError
              ? "Importação interrompida"
              : "Importação concluída"
            : "Importando curso..."}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full transition-all ${
              hasError ? "bg-rose-500" : done ? "bg-emerald-500" : "bg-brand-600"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          {current}/{total} passos concluídos ({pct}%)
        </p>
        <div className="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 p-4 max-h-[420px] overflow-auto font-mono text-xs leading-relaxed space-y-1">
          {logs.map((l, i) => (
            <div
              key={i}
              className={
                l.type === "error"
                  ? "text-rose-400"
                  : l.type === "success"
                    ? "text-emerald-400"
                    : "text-slate-300"
              }
            >
              {l.type === "success"
                ? "✓ "
                : l.type === "error"
                  ? "✗ "
                  : "• "}
              <span className="whitespace-pre-wrap">{l.message}</span>
            </div>
          ))}
        </div>

        {hasError && debugInfo && <DebugPanel debug={debugInfo} />}

        {done && !hasError && courseId && (
          <div className="pt-2">
            <AIFormattingPanel courseId={courseId} />
          </div>
        )}

        {(done || hasError) && (
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onBack}>
              Voltar para lista
            </Button>
            {hasError && (
              <Button variant="outline" onClick={onRetry}>
                Ajustar e tentar de novo
              </Button>
            )}
            {courseId && (
              <Button onClick={() => onOpenCourse(courseId)}>
                Abrir curso criado
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DebugPanel({
  debug,
}: {
  debug: {
    endpoint: string;
    payload: unknown;
    status?: number;
    response?: unknown;
  };
}) {
  const payloadJson = useMemo(() => {
    try {
      return JSON.stringify(debug.payload, null, 2);
    } catch {
      return String(debug.payload);
    }
  }, [debug.payload]);
  const responseJson = useMemo(() => {
    try {
      return JSON.stringify(debug.response, null, 2);
    } catch {
      return String(debug.response);
    }
  }, [debug.response]);

  const bundle = useMemo(
    () =>
      `Endpoint: ${debug.endpoint}
Status: ${debug.status ?? "—"}

── PAYLOAD ENVIADO ──
${payloadJson}

── RESPOSTA DO SERVIDOR ──
${responseJson}
`,
    [debug, payloadJson, responseJson]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bundle);
      toast.success("Debug copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-rose-900">
            Diagnóstico da requisição que falhou
          </p>
          <p className="text-xs text-rose-800/80 mt-0.5">
            <span className="font-mono">{debug.endpoint}</span>
            {debug.status ? ` · HTTP ${debug.status}` : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={copy}>
          Copiar tudo
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">
            Payload enviado
          </p>
          <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 text-slate-100 p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all">
            {payloadJson}
          </pre>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">
            Resposta do servidor
          </p>
          <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 text-slate-100 p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all">
            {responseJson}
          </pre>
        </div>
      </div>
    </div>
  );
}
