import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number | string | null | undefined) {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n as number)) return "R$ 0,00";
  return (n as number).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDurationFromMinutes(minutes: number | null | undefined) {
  const m = minutes ?? 0;
  if (m <= 0) return "0 min";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0 && r > 0) return `${h}h ${r}min`;
  if (h > 0) return `${h}h`;
  return `${r}min`;
}

export function calcFinalPrice(
  price: number | string | null | undefined,
  promotionalPrice: number | string | null | undefined
) {
  const p = Number(price ?? 0);
  const pp = Number(promotionalPrice ?? 0);
  if (pp > 0 && pp < p) return pp;
  return p;
}

export function pctDiscount(
  price: number | string | null | undefined,
  promotionalPrice: number | string | null | undefined
) {
  const p = Number(price ?? 0);
  const pp = Number(promotionalPrice ?? 0);
  if (!p || !pp || pp >= p) return 0;
  return Math.round(((p - pp) / p) * 100);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function plainTextToHtml(text: string): string {
  const value = (text ?? "").trim();
  if (!value) return "";
  const paragraphs = value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  return paragraphs.join("\n");
}

export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}
