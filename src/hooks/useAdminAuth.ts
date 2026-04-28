import { useCallback, useEffect, useState } from "react";

const AUTH_STORAGE_KEY = "curso_admin_auth_v1";

const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL || "adm@eduit.com.br"
)
  .trim()
  .toLowerCase();

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "eduit777@";

function readStoredAuth(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    readStoredAuth()
  );

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === AUTH_STORAGE_KEY) {
        setIsAuthenticated(event.newValue === "1");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const normalizedEmail = email.trim().toLowerCase();
      const ok =
        normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD;
      if (!ok) return false;
      try {
        window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      setIsAuthenticated(true);
      return true;
    },
    []
  );

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, login, logout };
}
