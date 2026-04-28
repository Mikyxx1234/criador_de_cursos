import { apiRequest } from "./apiClient";
import { normalizeActivity } from "@/lib/normalizeActivity";
import type { ActivityCreateDTO, ActivityResponse } from "@/types/activity";

export async function createActivity(
  courseId: number,
  dto: ActivityCreateDTO
): Promise<ActivityResponse> {
  const data = await apiRequest<{
    message: string;
    activity: unknown;
  }>({
    method: "POST",
    url: `/courses/${courseId}/activities`,
    data: dto,
    headers: { "Content-Type": "application/json" },
  });
  console.log("[createActivity] raw response.activity:", data.activity);
  const normalized = normalizeActivity(data.activity);
  if (!normalized) {
    throw new Error("API retornou atividade em formato inesperado");
  }
  if (dto.type && normalized.type !== dto.type) {
    normalized.type = dto.type;
  }
  return normalized;
}

export async function updateActivity(
  activityId: number,
  dto: Partial<ActivityCreateDTO> & { order?: number }
): Promise<ActivityResponse> {
  const data = await apiRequest<{
    message: string;
    activity: unknown;
  }>({
    method: "PUT",
    url: `/activities/${activityId}`,
    data: dto,
    headers: { "Content-Type": "application/json" },
  });
  const normalized = normalizeActivity(data.activity);
  if (!normalized) {
    throw new Error("API retornou atividade em formato inesperado");
  }
  return normalized;
}

export async function deleteActivity(activityId: number): Promise<void> {
  await apiRequest<{ message: string }>({
    method: "DELETE",
    url: `/activities/${activityId}`,
  });
}

export async function reorderActivities(
  courseId: number,
  activities: { id: number; order: number }[]
): Promise<void> {
  await apiRequest<{ message: string }>({
    method: "PUT",
    url: `/courses/${courseId}/activities/reorder`,
    data: { activities },
    headers: { "Content-Type": "application/json" },
  });
}
