export const DIFFICULTY_LEVELS = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
] as const;

export const CATEGORIES = [
  { value: "programacao", label: "Programação" },
  { value: "banco_dados", label: "Banco de Dados" },
  { value: "produtividade", label: "Produtividade" },
  { value: "lideranca", label: "Liderança" },
  { value: "marketing", label: "Marketing" },
  { value: "design", label: "Design" },
  { value: "negocios", label: "Negócios" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "outros", label: "Outros" },
] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]["value"];
export type Category = (typeof CATEGORIES)[number]["value"];

export interface CourseFormValues {
  title: string;
  description: string;
  short_description?: string;
  workload: number;
  modules_count?: number;
  difficulty_level?: DifficultyLevel | "";
  category?: Category | "";
  price: number;
  promotional_price?: number | null;
  discount_percentage?: number | null;
  is_active: boolean;
  cover_image?: File | null;
}

export interface CourseResponse {
  id: number;
  title: string;
  description: string;
  short_description?: string | null;
  long_description?: string | null;
  cover_image_url?: string | null;
  workload: number;
  modules_count?: number | null;
  difficulty_level?: string | null;
  difficulty_level_label?: string | null;
  category?: string | null;
  category_label?: string | null;
  price: string | number;
  promotional_price?: string | number | null;
  discount_percentage?: number | null;
  final_price?: string | number | null;
  discount_amount?: string | number | null;
  is_free?: boolean;
  has_discount?: boolean;
  is_active: boolean;
  activities_count?: number;
  activities?: unknown[];
  total_duration?: number;
  created_at?: string;
  updated_at?: string;
}
