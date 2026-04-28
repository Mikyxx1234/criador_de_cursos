import { useCallback, useEffect, useState } from "react";
import type { CourseResponse } from "@/types/course";
import type { ActivityResponse } from "@/types/activity";
import { normalizeActivityList } from "@/lib/normalizeActivity";

const STORAGE_KEY = "curso_admin_builder_v1";

export type BuilderStep = 1 | 2 | 3 | 4 | 5;

export interface BuilderState {
  course: CourseResponse | null;
  activities: ActivityResponse[];
  quizActivityId: number | null;
  finalExamActivityId: number | null;
  currentStep: BuilderStep;
}

const initialState: BuilderState = {
  course: null,
  activities: [],
  quizActivityId: null,
  finalExamActivityId: null,
  currentStep: 1,
};

function loadFromStorage(): BuilderState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as BuilderState;
    const activities = normalizeActivityList(parsed.activities ?? []);
    return { ...initialState, ...parsed, activities };
  } catch {
    return initialState;
  }
}

function saveToStorage(state: BuilderState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function useCourseBuilder() {
  const [state, setState] = useState<BuilderState>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const setCourse = useCallback((course: CourseResponse) => {
    setState((s) => ({
      ...s,
      course,
      currentStep: s.currentStep < 2 ? 2 : s.currentStep,
    }));
  }, []);

  const updateCourse = useCallback((course: CourseResponse) => {
    setState((s) => ({ ...s, course }));
  }, []);

  const setCurrentStep = useCallback((step: BuilderStep) => {
    setState((s) => ({ ...s, currentStep: step }));
  }, []);

  const addActivity = useCallback((activity: ActivityResponse) => {
    setState((s) => {
      const next = [...s.activities, activity];
      next.sort((a, b) => a.order - b.order);
      const extra: Partial<BuilderState> = {};
      if (activity.type === "quiz" && activity.quiz?.id) {
        extra.quizActivityId = activity.quiz.id;
      }
      if (activity.type === "final_exam" && activity.final_exam?.id) {
        extra.finalExamActivityId = activity.final_exam.id;
      }
      return { ...s, ...extra, activities: next };
    });
  }, []);

  const replaceActivity = useCallback((activity: ActivityResponse) => {
    setState((s) => {
      const next = s.activities.map((a) => (a.id === activity.id ? activity : a));
      next.sort((a, b) => a.order - b.order);
      return { ...s, activities: next };
    });
  }, []);

  const removeActivity = useCallback((activityId: number) => {
    setState((s) => {
      const removed = s.activities.find((a) => a.id === activityId);
      const next = s.activities.filter((a) => a.id !== activityId);
      const extra: Partial<BuilderState> = {};
      if (removed?.type === "quiz") extra.quizActivityId = null;
      if (removed?.type === "final_exam") extra.finalExamActivityId = null;
      return { ...s, ...extra, activities: next };
    });
  }, []);

  const reorderLocalActivities = useCallback(
    (ordered: ActivityResponse[]) => {
      setState((s) => ({
        ...s,
        activities: ordered.map((a, i) => ({ ...a, order: i + 1 })),
      }));
    },
    []
  );

  const reset = useCallback(() => {
    setState(initialState);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const loadCourseIntoBuilder = useCallback(
    (course: CourseResponse, step: BuilderStep = 1) => {
      const activities = normalizeActivityList(
        (course.activities as unknown[]) ?? []
      );
      const quiz = activities.find((a) => a.type === "quiz");
      const exam = activities.find((a) => a.type === "final_exam");
      console.log(
        "[loadCourseIntoBuilder] atividades carregadas:",
        activities.length,
        "- tipos:",
        activities.map((a) => a.type)
      );
      setState({
        course,
        activities,
        quizActivityId: quiz?.quiz?.id ?? null,
        finalExamActivityId: exam?.final_exam?.id ?? null,
        currentStep: step,
      });
    },
    []
  );

  const hasFinalExam = state.activities.some((a) => a.type === "final_exam");

  return {
    state,
    setCourse,
    updateCourse,
    setCurrentStep,
    addActivity,
    replaceActivity,
    removeActivity,
    reorderLocalActivities,
    reset,
    loadCourseIntoBuilder,
    hasFinalExam,
  };
}
