import { apiRequest } from "./apiClient";
import { normalizeActivityList } from "@/lib/normalizeActivity";
import { saveCoverFromFile, saveCoverUrl } from "@/lib/coverCache";
import { compressImageFile } from "@/lib/imageCompress";
import {
  uploadCoverToSupabase,
  isSupabaseConfigured,
} from "./supabaseClient";
import type { CourseFormValues, CourseResponse } from "@/types/course";

function appendIfDefined(fd: FormData, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  if (typeof value === "boolean") {
    fd.append(key, value ? "1" : "0");
  } else {
    fd.append(key, String(value));
  }
}

async function buildCourseFormData(
  values: CourseFormValues
): Promise<FormData> {
  const fd = new FormData();
  appendIfDefined(fd, "title", values.title);
  appendIfDefined(fd, "description", values.description);
  appendIfDefined(fd, "short_description", values.short_description);
  appendIfDefined(fd, "workload", values.workload);
  appendIfDefined(fd, "modules_count", values.modules_count);
  appendIfDefined(fd, "difficulty_level", values.difficulty_level);
  appendIfDefined(fd, "category", values.category);
  appendIfDefined(fd, "price", values.price);
  appendIfDefined(fd, "promotional_price", values.promotional_price);
  appendIfDefined(fd, "discount_percentage", values.discount_percentage);
  appendIfDefined(fd, "is_active", values.is_active);

  if (values.cover_image instanceof File) {
    const beforeKb = Math.round(values.cover_image.size / 1024);
    let toUpload: File = values.cover_image;
    try {
      toUpload = await compressImageFile(values.cover_image);
    } catch (e) {
      console.warn("[courseService] falha ao comprimir capa:", e);
    }
    const afterKb = Math.round(toUpload.size / 1024);
    if (toUpload !== values.cover_image) {
      console.log(
        `[courseService] capa comprimida: ${beforeKb}KB → ${afterKb}KB (${toUpload.type})`
      );
    }

    // Tenta subir a capa para o Supabase Storage e enviar a URL pública para
    // o backend. Isso garante que a capa fique disponível em qualquer cliente
    // (admin, site público) sem depender do storage do Laravel.
    if (isSupabaseConfigured()) {
      try {
        const result = await uploadCoverToSupabase(toUpload);
        console.log(
          `[courseService] capa enviada ao Supabase: ${result.publicUrl}`
        );
        // Mandamos a URL em vários nomes possíveis para maximizar a chance
        // de o backend aceitar o campo já existente.
        fd.append("cover_image_url", result.publicUrl);
        fd.append("cover_url", result.publicUrl);
        fd.append("external_cover_url", result.publicUrl);
      } catch (e) {
        console.warn(
          "[courseService] falha ao subir capa no Supabase, seguindo só com upload Laravel:",
          e
        );
      }
    }

    fd.append("cover_image", toUpload);
  }
  return fd;
}

/** Extrai do FormData a URL pública da capa subida no Supabase, se houver. */
function extractCoverUrlFromFormData(fd: FormData): string | null {
  const v =
    fd.get("cover_image_url") ||
    fd.get("cover_url") ||
    fd.get("external_cover_url");
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Cacheia localmente o arquivo de capa enviado pelo usuário, ignorando
 * silenciosamente qualquer erro do IndexedDB (cache é "best effort", o
 * fluxo principal de upload não pode falhar por causa disso).
 */
async function tryCacheCover(courseId: number, file: unknown): Promise<void> {
  if (!(file instanceof File)) return;
  try {
    await saveCoverFromFile(courseId, file);
  } catch (e) {
    console.warn("[coverCache] não foi possível salvar capa local:", e);
  }
}

export async function createCourse(
  values: CourseFormValues
): Promise<CourseResponse> {
  const fd = await buildCourseFormData(values);
  const supaCoverUrl = extractCoverUrlFromFormData(fd);
  const data = await apiRequest<{ message: string; course: CourseResponse }>({
    method: "POST",
    url: "/courses",
    data: fd,
  });
  await tryCacheCover(data.course.id, values.cover_image);
  if (supaCoverUrl) {
    await saveCoverUrl(data.course.id, supaCoverUrl).catch(() => {});
    // Sobrescreve o cover_image_url com a URL do Supabase para que o admin
    // (e qualquer cliente que receba este objeto) renderize a versão correta.
    if (
      !data.course.cover_image_url ||
      !data.course.cover_image_url.includes("/storage/v1/object/")
    ) {
      data.course.cover_image_url = supaCoverUrl;
    }
  }
  return data.course;
}

export async function updateCourse(
  courseId: number,
  values: Partial<CourseFormValues>
): Promise<CourseResponse> {
  const fd = await buildCourseFormData(values as CourseFormValues);
  fd.append("_method", "PUT");
  const supaCoverUrl = extractCoverUrlFromFormData(fd);
  const data = await apiRequest<{ message: string; course: CourseResponse }>({
    method: "POST",
    url: `/courses/${courseId}`,
    data: fd,
  });
  await tryCacheCover(courseId, values.cover_image);
  if (supaCoverUrl) {
    await saveCoverUrl(courseId, supaCoverUrl).catch(() => {});
    if (
      !data.course.cover_image_url ||
      !data.course.cover_image_url.includes("/storage/v1/object/")
    ) {
      data.course.cover_image_url = supaCoverUrl;
    }
  }
  return data.course;
}

export async function getCourse(courseId: number): Promise<CourseResponse> {
  const data = await apiRequest<{ course: CourseResponse } | CourseResponse>({
    method: "GET",
    url: `/courses/${courseId}`,
  });
  const course =
    (data as { course?: CourseResponse }).course ?? (data as CourseResponse);

  const rawActivities = (course as unknown as Record<string, unknown>)
    .activities;
  console.log(
    "[getCourse] raw activities (amostra):",
    Array.isArray(rawActivities) ? rawActivities.slice(0, 3) : rawActivities
  );

  const normalized = normalizeActivityList(rawActivities);
  console.log(
    `[getCourse] ${normalized.length} atividade(s) normalizadas. Tipos:`,
    normalized.map((a) => a.type)
  );

  const result = {
    ...course,
    activities: normalized as unknown[],
  } as CourseResponse & { __rawActivities?: unknown[] };
  if (Array.isArray(rawActivities)) {
    result.__rawActivities = rawActivities;
  }
  return result;
}

export interface ListCoursesParams {
  search?: string;
  category?: string;
  difficulty_level?: string;
  is_active?: boolean | "all";
  page?: number;
  per_page?: number;
}

export interface PaginatedCourses {
  courses: CourseResponse[];
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
}

export async function listCourses(
  params: ListCoursesParams = {}
): Promise<PaginatedCourses> {
  const query: Record<string, string | number> = {};
  if (params.search) query.search = params.search;
  if (params.category) query.category = params.category;
  if (params.difficulty_level)
    query.difficulty_level = params.difficulty_level;
  if (params.is_active !== undefined && params.is_active !== "all") {
    query.is_active = params.is_active ? 1 : 0;
  }
  if (params.page) query.page = params.page;
  if (params.per_page) query.per_page = params.per_page;

  const data = await apiRequest<unknown>({
    method: "GET",
    url: "/courses",
    params: query,
  });

  return normalizeCourseList(data);
}

function normalizeCourseList(raw: unknown): PaginatedCourses {
  const empty: PaginatedCourses = {
    courses: [],
    total: 0,
    page: 1,
    perPage: 15,
    lastPage: 1,
  };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;

  // Laravel paginator (direto)
  if (Array.isArray(obj.data)) {
    return {
      courses: obj.data as CourseResponse[],
      total: Number(obj.total ?? (obj.data as unknown[]).length),
      page: Number(obj.current_page ?? 1),
      perPage: Number(obj.per_page ?? 15),
      lastPage: Number(obj.last_page ?? 1),
    };
  }

  // { courses: Paginator } ou { courses: [] }
  if (obj.courses) {
    const c = obj.courses as Record<string, unknown> | CourseResponse[];
    if (Array.isArray(c)) {
      return {
        ...empty,
        courses: c,
        total: c.length,
      };
    }
    if (Array.isArray(c.data)) {
      return {
        courses: c.data as CourseResponse[],
        total: Number(c.total ?? (c.data as unknown[]).length),
        page: Number(c.current_page ?? 1),
        perPage: Number(c.per_page ?? 15),
        lastPage: Number(c.last_page ?? 1),
      };
    }
  }

  if (Array.isArray(raw)) {
    return {
      ...empty,
      courses: raw as CourseResponse[],
      total: (raw as unknown[]).length,
    };
  }

  return empty;
}

export async function deleteCourse(courseId: number): Promise<void> {
  await apiRequest<{ message?: string }>({
    method: "DELETE",
    url: `/courses/${courseId}`,
  });
}
