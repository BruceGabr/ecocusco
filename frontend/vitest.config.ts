import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/vitest.setup.ts",
    // App.test.tsx levanta un backend FastAPI real y hace varias idas y vueltas
    // HTTP por test. Con los 5s/10s por defecto la suite falla de forma
    // intermitente cuando la máquina está cargada (y más aún en CI).
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
