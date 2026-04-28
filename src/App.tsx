import { LogOut } from "lucide-react";
import { AdminShell } from "@/pages/AdminShell";
import { LoginPage } from "@/pages/LoginPage";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function App() {
  const { isAuthenticated, logout } = useAdminAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <AdminShell />
      <button
        type="button"
        onClick={logout}
        title="Sair"
        aria-label="Sair"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 h-9 text-xs font-medium text-slate-600 border border-slate-200 shadow-soft hover:bg-white hover:text-rose-600 hover:border-rose-200 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </button>
    </>
  );
}
