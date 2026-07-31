import { Bootstrap, View } from "./types";

export const geoBase = import.meta.env.VITE_GEO_URL ?? "/geo";

export const viewLabels: Record<View, string> = {
  dashboard: "Panel Principal",
  schedules: "Horarios",
  reports: "Reportes",
  waste: "Clasificación",
  routes: "Rutas",
  admin: "Administración",
  analytics: "Estadísticas"
};

export const views = Object.keys(viewLabels) as View[];

export const emptyBootstrap: Bootstrap = {
  zones: [],
  schedules: [],
  trucks: [],
  routes: [],
  reports: [],
  collections: [],
  analytics: { zones: 0, active_trucks: 0, open_reports: 0, confirmed_collections: 0, total_kg: 0, compliance: 0 }
};

export function getOperationalSignal(data: Bootstrap) {
  const delayedRoutes = data.routes.filter(route => route.delay.toLowerCase().includes("retraso")).length;
  if (data.analytics.open_reports > 2 || delayedRoutes > 0) {
    return { label: `${data.analytics.open_reports} incidencias abiertas`, tone: "warning" };
  }
  if (data.analytics.active_trucks === 0) {
    return { label: "Sin camiones activos", tone: "danger" };
  }
  return { label: "Operación estable", tone: "ok" };
}
