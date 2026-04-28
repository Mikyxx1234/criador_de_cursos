export type CorrectOption = "a" | "b" | "c" | "d";

export interface QuestionDraft {
  _localId: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: CorrectOption;
  order: number;
}

export interface QuestionPayload {
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: CorrectOption;
  order: number;
}

export interface QuestionsBulkPayload {
  questions: QuestionPayload[];
}
