import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Eye,
  FileUp,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";

import {
  deleteCourse,
  listCourses,
  updateCourse,
  type PaginatedCourses,
} from "@/services/courseService";
import { parseApiError } from "@/services/apiClient";
import {
  CATEGORIES,
  DIFFICULTY_LEVELS,
  type CourseResponse,
} from "@/types/course";
import { calcFinalPrice, cn, formatBRL, pctDiscount } from "@/lib/utils";
import { CourseCoverImage } from "@/components/course/CourseCoverImage";
import { RenewTokenModal } from "@/components/auth/RenewTokenModal";

interface CoursesListPageProps {
  onCreateNew: () => void;
  onEdit: (courseId: number) => void;
  onImport?: () => void;
}

type StatusFilter = "all" | "active" | "inactive";
type ViewMode = "cards" | "list";

const VIEW_MODE_STORAGE_KEY = "curso_admin_view_mode_v1";

function loadInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "cards";
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return raw === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

export function CoursesListPage({
  onCreateNew,
  onEdit,
  onImport,
}: CoursesListPageProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PaginatedCourses | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);

  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<CourseResponse | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [renewTokenOpen, setRenewTokenOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    loadInitialViewMode()
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, difficulty, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorStatus(undefined);
    try {
      const result = await listCourses({
        search: debouncedSearch || undefined,
        category: category || undefined,
        difficulty_level: difficulty || undefined,
        is_active:
          status === "all" ? "all" : status === "active" ? true : false,
        page,
        per_page: 15,
      });
      setData(result);
    } catch (e) {
      const parsed = parseApiError(e);
      setError(parsed.message);
      setErrorStatus(parsed.status);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, difficulty, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (course: CourseResponse) => {
    setTogglingId(course.id);
    const desired = !course.is_active;
    try {
      const p = updateCourse(course.id, { is_active: desired } as never);
      toast.promise(p, {
        loading: desired ? "Ativando..." : "Desativando...",
        success: desired ? "Curso ativado" : "Curso desativado",
        error: (e) => parseApiError(e).message || "Falha ao alterar status",
      });
      const updated = await p;
      setData((prev) =>
        prev
          ? {
              ...prev,
              courses: prev.courses.map((c) =>
                c.id === updated.id ? { ...c, ...updated } : c
              ),
            }
          : prev
      );
    } catch {
      // erro tratado pelo toast
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!courseToDelete) return;
    setDeleting(true);
    try {
      const p = deleteCourse(courseToDelete.id);
      toast.promise(p, {
        loading: "Excluindo curso...",
        success: `Curso "${courseToDelete.title}" excluído.`,
        error: (e) => parseApiError(e).message || "Falha ao excluir",
      });
      await p;
      setCourseToDelete(null);
      await load();
    } catch {
      // erro tratado
    } finally {
      setDeleting(false);
    }
  };

  const totalLabel = useMemo(() => {
    if (!data) return "";
    const t = data.total;
    return `${t} curso${t === 1 ? "" : "s"} encontrado${t === 1 ? "" : "s"}`;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <PageHeader
          title="Meus cursos"
          subtitle="Gerencie todos os cursos publicados. Edite, ative/desative e organize sua vitrine."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenewTokenOpen(true)}
                icon={<KeyRound className="h-4 w-4" />}
                title="Renovar o token de acesso à API"
              >
                Renovar token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                icon={<RefreshCw className="h-4 w-4" />}
                loading={loading}
              >
                Atualizar
              </Button>
              {onImport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onImport}
                  icon={<FileUp className="h-4 w-4" />}
                >
                  Importar do Word
                </Button>
              )}
              <Button
                size="sm"
                onClick={onCreateNew}
                icon={<Plus className="h-4 w-4" />}
              >
                Criar novo curso
              </Button>
            </>
          }
        />

        <RenewTokenModal
          open={renewTokenOpen}
          onClose={() => setRenewTokenOpen(false)}
          onTokenChanged={load}
        />

        <FiltersBar
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          status={status}
          setStatus={setStatus}
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {loading ? "Carregando..." : totalLabel}
          </span>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        {error && (
          <Card className="mt-4 bg-rose-50 border-rose-200">
            <CardContent className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-800">
                  Não foi possível carregar os cursos
                </p>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
                {(errorStatus === 401 || errorStatus === 403) && (
                  <p className="text-xs text-rose-700 mt-1">
                    Parece que o token expirou. Use o botão abaixo para gerar
                    um novo via login de admin.
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {(errorStatus === 401 || errorStatus === 403) && (
                  <Button
                    size="sm"
                    onClick={() => setRenewTokenOpen(true)}
                    icon={<KeyRound className="h-4 w-4" />}
                  >
                    Renovar token
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={load}>
                  Tentar novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-4">
          {loading && !data ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : data && data.courses.length === 0 ? (
            <EmptyState onCreateNew={onCreateNew} hasFilters={Boolean(debouncedSearch || category || difficulty || status !== "all")} />
          ) : data ? (
            viewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.courses.map((course) => (
                  <CourseListItem
                    key={course.id}
                    course={course}
                    toggling={togglingId === course.id}
                    onEdit={() => onEdit(course.id)}
                    onToggleActive={() => handleToggleActive(course)}
                    onDelete={() => setCourseToDelete(course)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.courses.map((course) => (
                  <CourseListRow
                    key={course.id}
                    course={course}
                    toggling={togglingId === course.id}
                    onEdit={() => onEdit(course.id)}
                    onToggleActive={() => handleToggleActive(course)}
                    onDelete={() => setCourseToDelete(course)}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>

        {data && data.lastPage > 1 && (
          <Pagination
            currentPage={data.page}
            lastPage={data.lastPage}
            onPageChange={setPage}
          />
        )}
      </div>

      <Modal
        open={!!courseToDelete}
        onClose={() => (deleting ? null : setCourseToDelete(null))}
        title="Excluir curso"
        description="Essa ação é permanente e não pode ser desfeita."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setCourseToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Excluir definitivamente
            </Button>
          </>
        }
      >
        {courseToDelete && (
          <div className="text-sm text-slate-700 leading-relaxed">
            Você está prestes a excluir{" "}
            <span className="font-semibold text-slate-900">
              "{courseToDelete.title}"
            </span>
            . Todas as atividades, quizzes e provas vinculadas também serão
            removidas do backend.
          </div>
        )}
      </Modal>
    </div>
  );
}

interface FiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  difficulty: string;
  setDifficulty: (v: string) => void;
  status: StatusFilter;
  setStatus: (v: StatusFilter) => void;
}

function FiltersBar({
  search,
  setSearch,
  category,
  setCategory,
  difficulty,
  setDifficulty,
  status,
  setStatus,
}: FiltersBarProps) {
  return (
    <Card className="mt-6">
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Input
            label="Buscar"
            placeholder="Título ou descrição"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute right-3 bottom-3 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>

        <Select
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { value: "", label: "Todas" },
            ...CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
          ]}
        />

        <Select
          label="Dificuldade"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          options={[
            { value: "", label: "Todas" },
            ...DIFFICULTY_LEVELS.map((d) => ({
              value: d.value,
              label: d.label,
            })),
          ]}
        />

        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Ativos" },
            { value: "inactive", label: "Inativos" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

interface CourseListItemProps {
  course: CourseResponse;
  toggling: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function CourseListItem({
  course,
  toggling,
  onEdit,
  onToggleActive,
  onDelete,
}: CourseListItemProps) {
  const price = Number(course.price ?? 0);
  const promo = course.promotional_price
    ? Number(course.promotional_price)
    : null;
  const finalPrice = calcFinalPrice(price, promo);
  const discount = pctDiscount(price, promo);
  const isFree = price === 0;

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="aspect-[16/9] bg-slate-100 relative overflow-hidden">
        <CourseCoverImage
          url={course.cover_image_url}
          alt={course.title}
          courseId={course.id}
          title={course.title}
          category={course.category}
          categoryLabel={course.category_label}
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {course.is_active ? (
            <Badge tone="success">Ativo</Badge>
          ) : (
            <Badge tone="neutral">Inativo</Badge>
          )}
          {isFree ? (
            <Badge tone="sky">Gratuito</Badge>
          ) : promo && promo < price ? (
            <Badge tone="amber">-{discount}%</Badge>
          ) : null}
        </div>
      </div>

      <CardContent className="flex flex-col gap-3 flex-1">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">
            {course.title}
          </h3>
          {course.short_description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {course.short_description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {course.category_label && (
            <Badge tone="brand">{course.category_label}</Badge>
          )}
          {course.difficulty_level_label && (
            <Badge tone="violet">{course.difficulty_level_label}</Badge>
          )}
          {course.workload && <Badge>{course.workload}h</Badge>}
          {course.activities_count !== undefined && (
            <Badge>{course.activities_count} atividades</Badge>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          {isFree ? (
            <span className="text-base font-semibold text-emerald-700">
              Gratuito
            </span>
          ) : (
            <>
              {promo && promo < price && (
                <span className="text-xs text-slate-400 line-through">
                  {formatBRL(price)}
                </span>
              )}
              <span className="text-base font-semibold text-slate-900">
                {formatBRL(finalPrice)}
              </span>
            </>
          )}
          <span className="ml-auto text-[11px] text-slate-400">
            ID {course.id}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-slate-200/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            icon={<Pencil className="h-3.5 w-3.5" />}
          >
            Editar
          </Button>
          <Button
            variant={course.is_active ? "ghost" : "primary"}
            size="sm"
            onClick={onToggleActive}
            loading={toggling}
            icon={<Power className="h-3.5 w-3.5" />}
          >
            {course.is_active ? "Desativar" : "Ativar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-rose-600 hover:bg-rose-50"
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-soft">
      <button
        type="button"
        onClick={() => onChange("cards")}
        aria-pressed={value === "cards"}
        title="Visualizar em cards"
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors",
          value === "cards"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Cards
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
        title="Visualizar em lista"
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors",
          value === "list"
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        <ListIcon className="h-3.5 w-3.5" />
        Lista
      </button>
    </div>
  );
}

function CourseListRow({
  course,
  toggling,
  onEdit,
  onToggleActive,
  onDelete,
}: CourseListItemProps) {
  const price = Number(course.price ?? 0);
  const promo = course.promotional_price
    ? Number(course.promotional_price)
    : null;
  const finalPrice = calcFinalPrice(price, promo);
  const discount = pctDiscount(price, promo);
  const isFree = price === 0;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lift">
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-44 md:w-52 shrink-0 aspect-[16/9] sm:aspect-auto bg-slate-100 overflow-hidden">
          <CourseCoverImage
            url={course.cover_image_url}
            alt={course.title}
            courseId={course.id}
            title={course.title}
            category={course.category}
            categoryLabel={course.category_label}
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {course.is_active ? (
              <Badge tone="success">Ativo</Badge>
            ) : (
              <Badge tone="neutral">Inativo</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col md:flex-row md:items-center gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-1 flex-1">
                {course.title}
              </h3>
              <span className="text-[11px] text-slate-400 shrink-0">
                ID {course.id}
              </span>
            </div>
            {course.short_description && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                {course.short_description}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {course.category_label && (
                <Badge tone="brand">{course.category_label}</Badge>
              )}
              {course.difficulty_level_label && (
                <Badge tone="violet">{course.difficulty_level_label}</Badge>
              )}
              {course.workload && <Badge>{course.workload}h</Badge>}
              {course.activities_count !== undefined && (
                <Badge>{course.activities_count} atividades</Badge>
              )}
              {isFree ? (
                <Badge tone="sky">Gratuito</Badge>
              ) : promo && promo < price ? (
                <Badge tone="amber">-{discount}%</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-1 md:min-w-[120px]">
            {isFree ? (
              <span className="text-sm font-semibold text-emerald-700">
                Gratuito
              </span>
            ) : (
              <div className="flex items-baseline gap-2">
                {promo && promo < price && (
                  <span className="text-[11px] text-slate-400 line-through">
                    {formatBRL(price)}
                  </span>
                )}
                <span className="text-sm font-semibold text-slate-900">
                  {formatBRL(finalPrice)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              icon={<Pencil className="h-3.5 w-3.5" />}
            >
              Editar
            </Button>
            <Button
              variant={course.is_active ? "ghost" : "primary"}
              size="sm"
              onClick={onToggleActive}
              loading={toggling}
              icon={<Power className="h-3.5 w-3.5" />}
            >
              {course.is_active ? "Desativar" : "Ativar"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-rose-600 hover:bg-rose-50"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              aria-label="Excluir"
              title="Excluir"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({
  onCreateNew,
  hasFilters,
}: {
  onCreateNew: () => void;
  hasFilters: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Eye className="h-10 w-10 text-slate-300" />
        <div>
          <p className="text-base font-semibold text-slate-800">
            {hasFilters
              ? "Nenhum curso corresponde aos filtros"
              : "Você ainda não criou nenhum curso"}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {hasFilters
              ? "Ajuste os filtros ou limpe-os para ver todos os cursos."
              : "Comece criando seu primeiro curso para alunos."}
          </p>
        </div>
        {!hasFilters && (
          <Button
            onClick={onCreateNew}
            icon={<Plus className="h-4 w-4" />}
            size="sm"
          >
            Criar primeiro curso
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Pagination({
  currentPage,
  lastPage,
  onPageChange,
}: {
  currentPage: number;
  lastPage: number;
  onPageChange: (page: number) => void;
}) {
  const pages = useMemo(() => {
    const arr: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(lastPage, start + 4);
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [currentPage, lastPage]);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Anterior
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          size="sm"
          variant={p === currentPage ? "primary" : "outline"}
          onClick={() => onPageChange(p)}
        >
          {p}
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === lastPage}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Próxima
      </Button>
    </div>
  );
}
