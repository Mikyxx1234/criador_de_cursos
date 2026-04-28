import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const VIDEOS_BUCKET =
  (import.meta.env.VITE_SUPABASE_VIDEOS_BUCKET as string | undefined) ||
  "videos_cursos";

export const COVERS_BUCKET =
  (import.meta.env.VITE_SUPABASE_COVERS_BUCKET as string | undefined) ||
  "capas_cursos";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env."
    );
  }
  if (!client) {
    client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: { persistSession: false },
    });
  }
  return client;
}

/**
 * Gera um nome de arquivo único no padrão:
 *   <prefix>/<timestamp>-<slug-original>.<ext>
 * Ex.: videos/1716512345678-introducao-ao-laravel.mp4
 */
function buildObjectPath(file: File, prefix = "videos"): string {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "bin";
  const base = (dot >= 0 ? file.name.slice(0, dot) : file.name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "video";
  return `${prefix}/${Date.now()}-${base}.${ext}`;
}

export interface UploadVideoResult {
  path: string;
  publicUrl: string;
}

/**
 * Sobe um arquivo de vídeo para o bucket configurado e retorna a URL pública.
 * Requer que o bucket tenha a policy adequada (público ou upload via anon).
 *
 * onProgress recebe um valor de 0 a 100.
 */
export async function uploadVideoToSupabase(
  file: File,
  options: {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<UploadVideoResult> {
  const supabase = getSupabase();
  const path = buildObjectPath(file, "videos");

  // O SDK do Supabase storage (v2) usa fetch sob o capô e não expõe progresso
  // nativo. Para ter progresso, usamos um XHR direto no endpoint REST de storage.
  // Se o ambiente não suportar XHR, caímos para o fluxo padrão do SDK.
  if (typeof XMLHttpRequest !== "undefined" && options.onProgress) {
    const url =
      `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/` +
      `${encodeURIComponent(VIDEOS_BUCKET)}/${path}`;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("x-upsert", "false");
      if (file.type) xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && options.onProgress) {
          options.onProgress(Math.round((ev.loaded / ev.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          let msg = `Falha no upload (HTTP ${xhr.status})`;
          try {
            const j = JSON.parse(xhr.responseText);
            msg = j?.message || j?.error || msg;
          } catch {
            /* ignore */
          }
          if (
            xhr.status === 400 &&
            /row-level security|violates row-level/i.test(msg)
          ) {
            msg =
              `O bucket "${VIDEOS_BUCKET}" do Supabase não tem policy de INSERT ` +
              `para a chave anon. Crie policies de SELECT/INSERT/UPDATE/DELETE ` +
              `em storage.objects para esse bucket e tente novamente.`;
          } else if (xhr.status === 404) {
            msg =
              `Bucket "${VIDEOS_BUCKET}" não encontrado no Supabase. ` +
              `Verifique a env VITE_SUPABASE_VIDEOS_BUCKET ou crie o bucket.`;
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () =>
        reject(new Error("Erro de rede ao enviar o vídeo para o Supabase."));
      xhr.onabort = () => reject(new DOMException("Upload cancelado", "AbortError"));

      if (options.signal) {
        options.signal.addEventListener("abort", () => xhr.abort(), {
          once: true,
        });
      }

      xhr.send(file);
    });
  } else {
    const { error } = await supabase.storage
      .from(VIDEOS_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
    if (error) throw error;
  }

  const { data } = supabase.storage.from(VIDEOS_BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl,
  };
}

/**
 * Remove um objeto do bucket a partir do path retornado pelo upload.
 */
export async function deleteVideoFromSupabase(path: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(VIDEOS_BUCKET).remove([path]);
  if (error) throw error;
}

export interface UploadCoverResult {
  path: string;
  publicUrl: string;
}

/**
 * Sobe uma imagem de capa de curso para o bucket de capas e retorna a URL
 * pública. O bucket precisa estar como "Public" e ter policies de
 * SELECT/INSERT em storage.objects para a anon key.
 */
export async function uploadCoverToSupabase(
  file: File
): Promise<UploadCoverResult> {
  const supabase = getSupabase();
  const path = buildObjectPath(file, "capas");

  const { error } = await supabase.storage
    .from(COVERS_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "31536000",
    });
  if (error) {
    const msg = error.message || String(error);
    if (/row-level security|violates row-level/i.test(msg)) {
      throw new Error(
        `O bucket "${COVERS_BUCKET}" do Supabase não tem policy de INSERT para a chave anon. ` +
          `Crie policies de SELECT/INSERT/UPDATE/DELETE em storage.objects para esse bucket.`
      );
    }
    if (/not found|does not exist/i.test(msg)) {
      throw new Error(
        `Bucket "${COVERS_BUCKET}" não encontrado no Supabase. ` +
          `Crie o bucket ou ajuste a env VITE_SUPABASE_COVERS_BUCKET.`
      );
    }
    throw new Error(msg);
  }

  const { data } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
