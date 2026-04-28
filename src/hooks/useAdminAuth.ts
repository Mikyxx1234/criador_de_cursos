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

// Estado compartilhado entre todas as instâncias do hook na mesma aba.
// Sem isso, cada componente que chama useAdminAuth() teria seu próprio
// useState e o login() em um deles não notificaria os outros — exigindo F5.
let currentAuth: boolean = readStoredAuth();
const subscribers = new Set<(value: boolean) => void>();

function broadcast(value: boolean) {
  currentAuth = value;
  subscribers.forEach((fn) => fn(value));
}

function setStoredAuth(value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  broadcast(value);
}

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => currentAuth
  );

  useEffect(() => {
    subscribers.add(setIsAuthenticated);
    if (isAuthenticated !== currentAuth) {
      setIsAuthenticated(currentAuth);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === AUTH_STORAGE_KEY) {
        broadcast(event.newValue === "1");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => {
      subscribers.delete(setIsAuthenticated);
      window.removeEventListener("storage", handleStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      const normalizedEmail = email.trim().toLowerCase();
      const ok =
        normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD;
      if (!ok) return false;
      setStoredAuth(true);
      return true;
    },
    []
  );

  const logout = useCallback(() => {
    setStoredAuth(false);
  }, []);

  return { isAuthenticated, login, logout };
}
