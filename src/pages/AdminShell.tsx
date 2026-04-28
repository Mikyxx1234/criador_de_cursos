import { useCallback, useEffect, useState } from "react";
import { CoursesListPage } from "./CoursesListPage";
import { CourseCreatorPage } from "./CourseCreatorPage";
import { CourseImportPage } from "./CourseImportPage";
import { useCourseBuilder } from "@/hooks/useCourseBuilder";

type View =
  | { name: "list" }
  | { name: "create" }
  | { name: "import" }
  | { name: "edit"; courseId: number };

const VIEW_STORAGE_KEY = "curso_admin_view_v1";

function loadInitialView(): View {
  if (typeof window === "undefined") return { name: "list" };
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (!raw) return { name: "list" };
    const parsed = JSON.parse(raw) as View;
    if (parsed?.name === "list") return { name: "list" };
    if (parsed?.name === "create") return { name: "create" };
    if (parsed?.name === "import") return { name: "import" };
    if (parsed?.name === "edit" && typeof parsed.courseId === "number") {
      return parsed;
    }
    return { name: "list" };
  } catch {
    return { name: "list" };
  }
}

export function AdminShell() {
  const [view, setView] = useState<View>(() => loadInitialView());
  const { reset } = useCourseBuilder();

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view));
    } catch {
      // ignore
    }
  }, [view]);

  const goToList = useCallback(() => {
    setView({ name: "list" });
  }, []);

  const goToCreate = useCallback(() => {
    reset();
    setView({ name: "create" });
  }, [reset]);

  const goToImport = useCallback(() => {
    setView({ name: "import" });
  }, []);

  const goToEdit = useCallback((courseId: number) => {
    setView({ name: "edit", courseId });
  }, []);

  if (view.name === "list") {
    return (
      <CoursesListPage
        onCreateNew={goToCreate}
        onEdit={goToEdit}
        onImport={goToImport}
      />
    );
  }

  if (view.name === "create") {
    return (
      <CourseCreatorPage editingCourseId={null} onBackToList={goToList} />
    );
  }

  if (view.name === "import") {
    return (
      <CourseImportPage
        onBackToList={goToList}
        onFinished={(courseId) => setView({ name: "edit", courseId })}
      />
    );
  }

  return (
    <CourseCreatorPage
      editingCourseId={view.courseId}
      onBackToList={goToList}
    />
  );
}
