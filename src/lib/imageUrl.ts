/**
 * Sane-ifies URLs de imagem retornadas pela API.
 *
 * O backend Laravel às vezes gera URLs com barra dupla quando o `APP_URL` está
 * com trailing slash no `.env`. Ex.:
 *   https://host//storage/course-covers/xxx.jpg
 *
 * Essa função:
 *  - Remove espaços em branco nas pontas
 *  - Remove barras duplicadas no caminho (preservando o `//` do protocolo)
 *  - Retorna `null` se a string for vazia/undefined
 */
export function sanitizeImageUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;

  // Preserva o "://", colapsa sequências de '/' duplicadas no resto da URL.
  const fixed = trimmed.replace(/([^:])\/{2,}/g, "$1/");
  return fixed;
}

/**
 * SVG embutido como data-URL, usado como fallback genérico quando uma capa
 * falha em carregar e não temos contexto (sem título/categoria).
 */
export const COVER_IMAGE_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 340' preserveAspectRatio='xMidYMid slice'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='#e0e7ff'/>
          <stop offset='100%' stop-color='#c7d2fe'/>
        </linearGradient>
      </defs>
      <rect width='600' height='340' fill='url(#g)'/>
      <g fill='#6366f1' opacity='0.75'>
        <rect x='232' y='120' width='136' height='100' rx='12'/>
        <circle cx='276' cy='156' r='14' fill='#fff'/>
        <path d='M248 208l30-36 26 28 20-14 28 22z' fill='#fff'/>
      </g>
      <text x='300' y='260' text-anchor='middle' font-family='system-ui,-apple-system,sans-serif' font-size='18' fill='#4338ca' font-weight='600'>
        Capa indisponível
      </text>
    </svg>`
  );

const CATEGORY_GRADIENTS: Record<string, [string, string, string]> = {
  programacao: ["#0f172a", "#1e3a8a", "#38bdf8"],
  banco_dados: ["#0f172a", "#0e7490", "#22d3ee"],
  produtividade: ["#0f172a", "#065f46", "#34d399"],
  lideranca: ["#1f1147", "#5b21b6", "#c084fc"],
  marketing: ["#3b0764", "#a21caf", "#f472b6"],
  design: ["#7c2d12", "#be185d", "#fb923c"],
  negocios: ["#0c4a6e", "#0369a1", "#facc15"],
  tecnologia: ["#020617", "#1e40af", "#60a5fa"],
  outros: ["#0f172a", "#334155", "#94a3b8"],
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Quebra um título em até `maxLines` linhas com ~`maxChars` por linha,
 * cortando entre palavras. Usado para renderizar texto multi-linha em SVG
 * sem precisar do `<foreignObject>` (que tem problemas com data: URLs).
 */
function wrapTitle(title: string, maxChars = 24, maxLines = 3): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const last = lines.slice(maxLines - 1).join(" ");
    return [
      ...lines.slice(0, maxLines - 1),
      last.length > maxChars + 3 ? `${last.slice(0, maxChars)}…` : last,
    ];
  }
  return lines;
}

/**
 * Gera um data-URL SVG bonito mostrando o título do curso + categoria.
 * Usado quando a API não fornece capa OU quando a URL retorna 404 (situação
 * atual do servidor, em que o storage do Laravel está quebrado).
 */
export function generateCoverFallback(
  title: string,
  categorySlug?: string | null,
  categoryLabel?: string | null
): string {
  const palette =
    (categorySlug && CATEGORY_GRADIENTS[categorySlug]) ||
    CATEGORY_GRADIENTS.outros;
  const [c1, c2, c3] = palette;
  const lines = wrapTitle(title || "Sem título", 22, 3);
  const lineHeight = 38;
  const startY = 170 - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x='300' y='${startY + i * lineHeight}'>${escapeXml(line)}</tspan>`
    )
    .join("");

  const tag = categoryLabel
    ? `<g transform='translate(300, 282)'>
         <rect x='-${Math.max(40, categoryLabel.length * 6)}' y='-18' width='${Math.max(80, categoryLabel.length * 12)}' height='30' rx='15' fill='rgba(255,255,255,0.18)' stroke='rgba(255,255,255,0.35)'/>
         <text x='0' y='2' text-anchor='middle' dominant-baseline='middle' font-family='system-ui,-apple-system,sans-serif' font-size='13' fill='#ffffff' font-weight='600' letter-spacing='0.5'>${escapeXml(categoryLabel.toUpperCase())}</text>
       </g>`
    : "";

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 340' preserveAspectRatio='xMidYMid slice'>
    <defs>
      <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${c1}'/>
        <stop offset='60%' stop-color='${c2}'/>
        <stop offset='100%' stop-color='${c3}'/>
      </linearGradient>
      <radialGradient id='glow' cx='80%' cy='20%' r='60%'>
        <stop offset='0%' stop-color='rgba(255,255,255,0.35)'/>
        <stop offset='100%' stop-color='rgba(255,255,255,0)'/>
      </radialGradient>
    </defs>
    <rect width='600' height='340' fill='url(#bg)'/>
    <rect width='600' height='340' fill='url(#glow)'/>
    <g opacity='0.12' fill='#ffffff'>
      <circle cx='80' cy='280' r='90'/>
      <circle cx='540' cy='80' r='60'/>
    </g>
    <text text-anchor='middle' font-family='system-ui,-apple-system,sans-serif' font-size='30' fill='#ffffff' font-weight='700' letter-spacing='-0.5'>
      ${tspans}
    </text>
    ${tag}
  </svg>`;

  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
