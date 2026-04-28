import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  COVER_IMAGE_FALLBACK,
  generateCoverFallback,
  sanitizeImageUrl,
} from "@/lib/imageUrl";
import { useCachedCoverUrl } from "@/lib/coverCache";

interface CourseCoverImageProps {
  url?: string | null;
  alt?: string;
  className?: string;
  /**
   * Quando true, usa a URL "saneada" (remove barras duplas) automaticamente.
   * Padrão: true. Pode ser desabilitado para diagnóstico.
   */
  sanitize?: boolean;
  /**
   * Se fornecido, tenta primeiro uma capa salva no IndexedDB local com esse
   * ID. Útil enquanto o backend Laravel não estiver servindo /storage.
   */
  courseId?: number | null;
  /**
   * Título e categoria do curso, usados para gerar um fallback bonito quando
   * não temos capa válida (em vez do placeholder genérico).
   */
  title?: string | null;
  category?: string | null;
  categoryLabel?: string | null;
}

/**
 * Renderiza a capa do curso. Ordem de prioridade:
 *  1. Capa cacheada localmente no IndexedDB (set durante o upload).
 *  2. URL retornada pela API (saneada, sem barras duplas).
 *  3. Fallback gerado dinamicamente com título + categoria.
 *
 * Se a URL da API falhar ao carregar (404, CORS, etc.) cai automaticamente
 * para o fallback gerado.
 */
export function CourseCoverImage({
  url,
  alt = "Capa do curso",
  className,
  sanitize = true,
  courseId,
  title,
  category,
  categoryLabel,
}: CourseCoverImageProps) {
  const cachedUrl = useCachedCoverUrl(courseId ?? null);
  const sanitized = sanitize ? sanitizeImageUrl(url) : url ?? null;
  const [broken, setBroken] = useState(false);

  // URLs do Supabase Storage são confiáveis (público + CDN). Se a API já
  // estiver devolvendo essa URL, use-a direto sem precisar do cache local.
  const apiIsSupabase = Boolean(
    sanitized && /supabase\.(co|in)\/storage\/v1\/object\//.test(sanitized)
  );

  const fallback = useMemo(
    () =>
      title
        ? generateCoverFallback(title, category, categoryLabel)
        : COVER_IMAGE_FALLBACK,
    [title, category, categoryLabel]
  );

  useEffect(() => {
    setBroken(false);
  }, [sanitized, cachedUrl]);

  const src = apiIsSupabase
    ? (sanitized as string)
    : cachedUrl
      ? cachedUrl
      : !sanitized || broken
        ? fallback
        : sanitized;

  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      onError={() => {
        if (!broken) setBroken(true);
      }}
    />
  );
}
