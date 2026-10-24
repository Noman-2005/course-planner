import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    build: { target: "esnext" },
    esbuild: { target: "esnext" },
    optimizeDeps: { esbuildOptions: { target: "esnext" } },
    server: env.VITE_API_PROXY
      ? { proxy: { "/api": { target: env.VITE_API_PROXY, changeOrigin: true, secure: true } } }
      : {},
  };
});