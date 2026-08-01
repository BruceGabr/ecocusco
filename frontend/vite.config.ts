import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:8000",
      "/geo": {
        target: "http://localhost:3100",
        rewrite: path => path.replace(/^\/geo/, "")
      }
    }
  },
  // La configuración de pruebas vive en vitest.config.ts, que tiene precedencia
  // sobre este archivo. Duplicarla aquí crearía config muerta y divergente.
});
