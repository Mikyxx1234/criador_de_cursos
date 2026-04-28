import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Em desenvolvimento, encaminhamos /api → backend remoto via proxy do Vite.
// Isso garante que o browser converse apenas com localhost (mesma origem),
// evitando bloqueios por extensões/adblock e CORS de domínios externos.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.VITE_API_BASE_URL || "";
  let proxyTarget: string | undefined;
  let proxyBasePath = "/api";
  try {
    const u = new URL(apiBase);
    proxyTarget = u.origin;
    proxyBasePath = u.pathname.replace(/\/$/, "") || "/api";
  } catch {
    proxyTarget = undefined;
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: proxyTarget
        ? {
            "/api": {
              target: proxyTarget,
              changeOrigin: true,
              secure: true,
              // Desabilita buffering/timeout para uploads grandes não serem
              // abortados durante o multipart streaming.
              proxyTimeout: 60_000,
              timeout: 60_000,
              rewrite: (urlPath) =>
                urlPath.replace(/^\/api/, proxyBasePath),
              configure: (proxy) => {
                proxy.on("error", (err, req) => {
                  console.error(
                    `[vite-proxy] ERROR ${req.method} ${req.url}:`,
                    err.message
                  );
                });
                proxy.on("proxyReq", (_proxyReq, req) => {
                  console.log(
                    `[vite-proxy] → ${req.method} ${req.url}`
                  );
                });
                proxy.on("proxyRes", (proxyRes, req) => {
                  console.log(
                    `[vite-proxy] ← ${proxyRes.statusCode} ${req.method} ${req.url}`
                  );
                });
              },
            },
          }
        : undefined,
    },
  };
});
