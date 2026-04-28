import { apiRequest } from "./apiClient";
import type { QuestionPayload } from "@/types/question";

export interface QuestionResponse {
  id: number;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  order: number;
}

export async function createQuizQuestions(
  quizActivityId: number,
  questions: QuestionPayload[]
): Promise<QuestionResponse[]> {
  const data = await apiRequest<{
    message: string;
    questions: QuestionResponse[];
  }>({
    method: "POST",
    url: `/quiz/${quizActivityId}/questions`,
    data: { questions },
    headers: { "Content-Type": "application/json" },
  });
  return data.questions;
}

export async function createFinalExamQuestions(
  finalExamActivityId: number,
  questions: QuestionPayload[]
): Promise<QuestionResponse[]> {
  const data = await apiRequest<{
    message: string;
    questions: QuestionResponse[];
  }>({
    method: "POST",
    url: `/final_exam/${finalExamActivityId}/questions`,
    data: { questions },
    headers: { "Content-Type": "application/json" },
  });
  return data.questions;
}

/**
 * Normaliza o payload de listagem, aceitando vários formatos de resposta que o
 * backend Laravel pode retornar (array puro, { questions: [] }, { data: [] } etc).
 */
function normalizeQuestionList(raw: unknown): QuestionResponse[] {
  if (Array.isArray(raw)) return raw as QuestionResponse[];
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.questions)) return obj.questions as QuestionResponse[];
  if (Array.isArray(obj.data)) return obj.data as QuestionResponse[];
  return [];
}

export async function getQuizQuestions(
  quizActivityId: number
): Promise<QuestionResponse[]> {
  try {
    const data = await apiRequest<unknown>({
      method: "GET",
      url: `/quiz/${quizActivityId}/questions`,
    });
    return normalizeQuestionList(data);
  } catch (e: unknown) {
    // Se o endpoint não existir (404) ou não houver questões, retorna lista vazia.
    const status = (e as { status?: number })?.status;
    if (status === 404) return [];
    throw e;
  }
}

export async function getFinalExamQuestions(
  finalExamActivityId: number
): Promise<QuestionResponse[]> {
  try {
    const data = await apiRequest<unknown>({
      method: "GET",
      url: `/final_exam/${finalExamActivityId}/questions`,
    });
    return normalizeQuestionList(data);
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 404) return [];
    throw e;
  }
}
