import axios, { AxiosError, AxiosRequestConfig } from "axios";

// Em dev usamos o proxy do Vite (/api) para evitar bloqueios por
// extensões/adblock e CORS de domínios externos. Em produção usamos a
// URL absoluta da variável de ambiente. Pode-se forçar a URL absoluta
// também em dev definindo VITE_API_USE_PROXY=false.
const ABS_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
const USE_PROXY =
  import.meta.env.DEV && import.meta.env.VITE_API_USE_PROXY !== "false";
const BASE_URL = USE_PROXY ? "/api" : ABS_BASE;
const ENV_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

const TOKEN_STORAGE_KEY = "curso_admin_api_token_v1";

/**
 * Token efetivo usado nas requisições. Prioridade:
 *  1. Token salvo no localStorage (renovado pela tela de "Renovar token")
 *  2. Token do `.env` (`VITE_API_TOKEN`) — usado como fallback inicial
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function getActiveToken(): string | null {
  return getStoredToken() || (ENV_TOKEN && ENV_TOKEN.trim()) || null;
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } catch {
    // ignore
  }
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Indica de onde está vindo o token efetivo no momento. Útil para a UI
 * informar ao admin se ele está usando o token padrão do `.env` ou um
 * token renovado manualmente.
 */
export function getTokenSource(): "storage" | "env" | "none" {
  if (getStoredToken()) return "storage";
  if (ENV_TOKEN && ENV_TOKEN.trim()) return "env";
  return "none";
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: "application/json",
  },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = getActiveToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ApiErrorShape {
  status?: number;
  message: string;
  errors?: Record<string, string[]>;
  raw?: unknown;
}

function isAlreadyParsed(v: unknown): v is ApiErrorShape {
  return (
    !!v &&
    typeof v === "object" &&
    "message" in v &&
    typeof (v as { message: unknown }).message === "string" &&
    !(v instanceof Error)
  );
}

export function parseApiError(error: unknown): ApiErrorShape {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{
      message?: string;
      errors?: Record<string, string[]>;
    }>;
    const data = err.response?.data;
    const errors = data?.errors;
    let message = data?.message || err.message || "Erro inesperado";

    if (errors && typeof errors === "object") {
      const first = Object.values(errors)[0];
      if (Array.isArray(first) && first[0]) {
        message = first[0];
      }
    }

    if (err.response?.status === 413) {
      message =
        "Arquivo muito grande para o servidor (HTTP 413). Tente reduzir o tamanho da imagem (máximo recomendado ~1MB).";
    }

    if (!err.response) {
      // Sem response = a request nunca chegou na API ou foi abortada antes
      // de receber retorno. Mostramos o code do axios para ajudar no
      // diagnóstico (ERR_NETWORK, ECONNABORTED, ERR_CANCELED, etc.).
      const code = err.code ? ` (${err.code})` : "";
      if (err.code === "ECONNABORTED" || /timeout/i.test(err.message)) {
        message = `Tempo esgotado ao falar com a API${code}. A conexão pode estar lenta ou o backend levou mais de ${apiClient.defaults.timeout}ms para responder.`;
      } else if (err.code === "ERR_CANCELED") {
        message = "A requisição foi cancelada antes de concluir.";
      } else {
        message =
          `Não foi possível conectar à API${code}. ` +
          `Possíveis causas: backend offline, bloqueio de extensão/adblock, ` +
          `antivírus interceptando ou problema de rede. Endpoint: ${BASE_URL}`;
      }
    }

    return {
      status: err.response?.status,
      message,
      errors,
      raw: data,
    };
  }
  if (isAlreadyParsed(error)) {
    return error;
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: "Erro desconhecido" };
}

/**
 * Faz um GET leve em /courses para validar conectividade com a API antes
 * de iniciar fluxos longos como a importação. Retorna `true` se ok.
 */
export async function pingApi(): Promise<{
  ok: boolean;
  status?: number;
  message?: string;
}> {
  try {
    const res = await apiClient.get("/courses", {
      params: { per_page: 1 },
      timeout: 10000,
    });
    return { ok: true, status: res.status };
  } catch (err) {
    const parsed = parseApiError(err);
    return { ok: false, status: parsed.status, message: parsed.message };
  }
}

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const res = await apiClient.request<T>(config);
    return res.data;
  } catch (err) {
    throw parseApiError(err);
  }
}

export function getApiConfig() {
  return {
    baseUrl: BASE_URL,
    hasToken: Boolean(getActiveToken()),
    tokenSource: getTokenSource(),
  };
}
