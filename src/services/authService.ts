import {
  apiRequest,
  clearStoredToken,
  getActiveToken,
  getStoredToken,
  getTokenSource,
  setStoredToken,
} from "./apiClient";

export interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponseShape {
  // O backend Laravel/Sanctum costuma responder em `token` ou `access_token`,
  // dependendo da versão. Cobrimos os dois para sermos resilientes.
  token?: string;
  access_token?: string;
  plainTextToken?: string;
  data?: {
    token?: string;
    access_token?: string;
  };
  user?: {
    id?: number;
    name?: string;
    email?: string;
    role?: string;
  };
}

/**
 * Faz login na API Laravel e retorna o token Sanctum gerado.
 * Conforme documentação (README): `POST /auth/login` com `email` e
 * `password`. As credenciais padrão de admin são
 * `admin@curso-platform.com` / `password`.
 */
export async function login(payload: LoginPayload): Promise<{
  token: string;
  user?: LoginResponseShape["user"];
}> {
  const data = await apiRequest<LoginResponseShape>({
    method: "POST",
    url: "/auth/login",
    data: payload,
    headers: { "Content-Type": "application/json" },
  });

  const token =
    data.token ||
    data.access_token ||
    data.plainTextToken ||
    data.data?.token ||
    data.data?.access_token;

  if (!token || typeof token !== "string") {
    throw {
      message:
        "A API respondeu sem token. Verifique se as credenciais correspondem a um usuário admin.",
      raw: data,
    };
  }

  return { token, user: data.user };
}

/**
 * Salva o token informado (vindo do login OU colado manualmente) e
 * passa a ser usado em todas as próximas requisições autenticadas.
 */
export function applyToken(token: string): void {
  setStoredToken(token);
}

export function logoutLocal(): void {
  clearStoredToken();
}

export interface CurrentTokenInfo {
  token: string | null;
  source: "storage" | "env" | "none";
  preview: string;
}

/**
 * Retorna dados úteis para mostrar ao admin (em uma tela de gestão de
 * token) sem expor o token inteiro: apenas os primeiros e últimos
 * caracteres.
 */
export function getCurrentTokenInfo(): CurrentTokenInfo {
  const token = getActiveToken();
  const source = getTokenSource();
  let preview = "—";
  if (token) {
    if (token.length <= 12) {
      preview = token;
    } else {
      preview = `${token.slice(0, 6)}…${token.slice(-6)}`;
    }
  }
  return { token, source, preview };
}

export { getStoredToken };
