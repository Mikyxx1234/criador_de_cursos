import {
  Clock,
  Layers,
  Tag,
  Gauge,
  CheckCircle2,
  CircleDashed,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import type { CourseResponse } from "@/types/course";
import type { ActivityResponse } from "@/types/activity";
import { calcFinalPrice, formatBRL, pctDiscount } from "@/lib/utils";
import { ACTIVITY_TYPES } from "@/types/activity";
import { CourseCoverImage } from "./CourseCoverImage";

interface CourseSidebarPreviewProps {
  course: CourseResponse | null;
  activities: ActivityResponse[];
  quizActivityId: number | null;
  finalExamActivityId: number | null;
}

export function CourseSidebarPreview({
  course,
  activities,
  quizActivityId,
  finalExamActivityId,
}: CourseSidebarPreviewProps) {
  const price = Number(course?.price ?? 0);
  const promo = course?.promotional_price
    ? Number(course.promotional_price)
    : null;
  const finalPrice = calcFinalPrice(price, promo);
  const discount = pctDiscount(price, promo);
  const isFree = price === 0;

  const typeLabel = (t: string) =>
    ACTIVITY_TYPES.find((a) => a.value === t)?.label ?? t;

  return (
    <div className="flex flex-col gap-4 sticky top-6">
      <Card className="overflow-hidden">
        <div className="aspect-video bg-slate-100 relative overflow-hidden">
          <CourseCoverImage
            url={course?.cover_image_url}
            alt={course?.title || "Capa"}
            courseId={course?.id ?? null}
            title={course?.title}
            category={course?.category}
            categoryLabel={course?.category_label}
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {course?.is_active ? (
              <Badge tone="success">Ativo</Badge>
            ) : (
              <Badge tone="neutral">Rascunho</Badge>
            )}
            {isFree ? (
              <Badge tone="sky">Gratuito</Badge>
            ) : promo && promo < price ? (
              <Badge tone="amber">Promocional</Badge>
            ) : (
              <Badge tone="violet">Pago</Badge>
            )}
          </div>
        </div>

        <CardContent className="flex flex-col gap-3">
          <div>
            <h4 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">
              {course?.title || "Título do curso"}
            </h4>
            {course?.short_description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-3">
                {course.short_description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-1">
            {course?.category && (
              <Badge tone="brand">
                <Tag className="h-3 w-3" />
                {course.category_label || course.category}
              </Badge>
            )}
            {course?.difficulty_level && (
              <Badge tone="violet">
                <Gauge className="h-3 w-3" />
                {course.difficulty_level_label || course.difficulty_level}
              </Badge>
            )}
            {course?.workload && (
              <Badge>
                <Clock className="h-3 w-3" />
                {course.workload}h
              </Badge>
            )}
            {course?.activities_count !== undefined && (
              <Badge>
                <Layers className="h-3 w-3" />
                {activities.length} atividades
              </Badge>
            )}
          </div>

          <div className="mt-2 pt-3 border-t border-slate-200/80">
            {isFree ? (
              <p className="text-lg font-semibold text-emerald-700">Gratuito</p>
            ) : (
              <div className="flex items-baseline gap-2">
                {promo && promo < price && (
                  <span className="text-sm text-slate-400 line-through">
                    {formatBRL(price)}
                  </span>
                )}
                <span className="text-xl font-semibold text-slate-900">
                  {formatBRL(finalPrice)}
                </span>
                {discount > 0 && (
                  <Badge tone="success">-{discount}%</Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText className="h-4 w-4 text-slate-500" />
            Status do builder
          </div>
          <StatusRow
            done={!!course}
            label="Curso criado"
            extra={course ? `ID ${course.id}` : undefined}
          />
          <StatusRow
            done={activities.length > 0}
            label="Atividades adicionadas"
            extra={activities.length ? `${activities.length} item(ns)` : undefined}
          />
          <StatusRow
            done={!!quizActivityId}
            label="Quiz configurado"
            extra={quizActivityId ? `Quiz ID ${quizActivityId}` : undefined}
          />
          <StatusRow
            done={!!finalExamActivityId}
            label="Prova final configurada"
            extra={
              finalExamActivityId
                ? `Exam ID ${finalExamActivityId}`
                : undefined
            }
          />
        </CardContent>
      </Card>

      {activities.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-slate-900">
              Estrutura ({activities.length})
            </div>
            <ol className="flex flex-col gap-1.5 mt-1">
              {activities.map((a, i) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <span className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700 inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="font-medium text-slate-800 line-clamp-1">
                    {a.title}
                  </span>
                  <span className="ml-auto text-[10px] text-slate-500 shrink-0">
                    {typeLabel(a.type)}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusRow({
  done,
  label,
  extra,
}: {
  done: boolean;
  label: string;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
      ) : (
        <CircleDashed className="h-4 w-4 text-slate-400 shrink-0" />
      )}
      <span className={done ? "text-slate-800" : "text-slate-500"}>
        {label}
      </span>
      {extra && (
        <span className="ml-auto text-[11px] text-slate-500">{extra}</span>
      )}
    </div>
  );
}
