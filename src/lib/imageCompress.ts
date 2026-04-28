/**
 * Comprime/redimensiona uma imagem no browser usando canvas, para evitar
 * que o upload exceda o `client_max_body_size` do servidor (Nginx default
 * geralmente é 1MB). A função é "best effort":
 *
 * - Mantém o arquivo original quando ele já está pequeno o suficiente.
 * - Redimensiona se exceder maxWidth/maxHeight (lado maior).
 * - Reduz a qualidade até caber dentro de targetMaxBytes (mínimo q=0.5).
 * - Para tipos não suportados pelo canvas (ex.: SVG, GIF animado),
 *   devolve o arquivo original.
 */
export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** Tamanho-alvo em bytes (acima disso reduzimos qualidade). */
  targetMaxBytes?: number;
  /** Tamanho a partir do qual NEM TENTAMOS comprimir. */
  skipUnderBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  targetMaxBytes: 900 * 1024, // 900KB (folga abaixo do limite de 1MB)
  skipUnderBytes: 700 * 1024, // se já está abaixo, não toca
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível decodificar a imagem."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

export async function compressImageFile(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  const cfg = { ...DEFAULTS, ...opts };

  if (!file.type.startsWith("image/")) return file;
  if (/svg|gif/i.test(file.type)) return file;
  if (file.size <= cfg.skipUnderBytes) return file;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }

  const ratio = Math.min(
    1,
    cfg.maxWidth / img.width,
    cfg.maxHeight / img.height
  );
  const targetW = Math.round(img.width * ratio);
  const targetH = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Sempre tentamos JPEG primeiro (compressão muito melhor que PNG para
  // capas fotográficas). Se for PNG com transparência, mantemos PNG.
  const isPngOpaque = file.type !== "image/png";
  const targetType = isPngOpaque ? "image/jpeg" : "image/png";

  const tryQualities = isPngOpaque ? [0.85, 0.75, 0.65, 0.55] : [1];
  let bestBlob: Blob | null = null;
  for (const q of tryQualities) {
    const blob = await canvasToBlob(canvas, targetType, q);
    if (!blob) continue;
    bestBlob = blob;
    if (blob.size <= cfg.targetMaxBytes) break;
  }
  if (!bestBlob) return file;

  // Se mesmo após compressão ficou maior que o original, devolve o
  // arquivo original (não vale a pena trocar).
  if (bestBlob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const ext = targetType === "image/jpeg" ? "jpg" : "png";
  return new File([bestBlob], `${baseName}.${ext}`, { type: targetType });
}
