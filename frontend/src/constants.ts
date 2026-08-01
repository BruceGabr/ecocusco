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

/** Catálogos compartidos: evitan texto libre donde el dominio es cerrado. */
export const WASTE_TYPES = ["Orgánicos", "Plástico", "Vidrio", "Papel", "No reciclables"] as const;
export const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export const TRUCK_STATUSES = ["En ruta", "Mantenimiento", "Disponible"] as const;
export const MAINTENANCE_STATUSES = ["Pendiente", "Completado"] as const;
export const REPORT_TYPES = ["Acumulacion de basura", "Retraso", "Contenedor lleno", "Otro"] as const;
export const CRITICALITY_LEVELS = ["Alta", "Media", "Baja"] as const;

/** Convierte una lista de textos en opciones para el componente Select. */
export const toOptions = (values: readonly string[]) => values.map(value => ({ value, label: value }));

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
  // El estado crítico se evalúa primero: antes, una flota totalmente detenida
  // se mostraba como simple advertencia si además había incidencias abiertas.
  if (data.analytics.active_trucks === 0) {
    return { label: "Sin camiones activos", tone: "danger" };
  }
  if (data.analytics.open_reports > 2 || delayedRoutes > 0) {
    const count = data.analytics.open_reports;
    const label = count === 1 ? "1 incidencia abierta" : `${count} incidencias abiertas`;
    return { label, tone: "warning" };
  }
  return { label: "Operación estable", tone: "ok" };
}
