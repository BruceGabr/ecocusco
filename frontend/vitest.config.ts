import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/vitest.setup.ts",
    // Aísla las pruebas de los archivos .env del desarrollador.
    //
    // Vitest carga `.env.local`, donde VITE_API_URL apunta al backend REAL de
    // Render. Sin esto, la suite ignoraba el FastAPI local que ella misma
    // levanta en el puerto 8010 y lanzaba contra producción: los tests que
    // crean, editan y borran zonas, usuarios o camiones estaban mutando la
    // base de datos desplegada. Con rutas relativas, el override de `fetch`
    // de App.test.tsx las redirige al backend local.
    env: {
      VITE_API_URL: "/api",
      VITE_GEO_URL: "/geo",
    },
    // App.test.tsx levanta un backend FastAPI real y hace varias idas y vueltas
    // HTTP por test. Con los 5s/10s por defecto la suite falla de forma
    // intermitente cuando la máquina está cargada (y más aún en CI).
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
