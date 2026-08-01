import React from "react";

export type StatusTone = "success" | "pending" | "danger" | "neutral";

/**
 * Mapa único estado de dominio → color semántico.
 *
 * El sistema de diseño admite exactamente 4 colores de estado
 * (ver .claude/skills/dashboard-ui-design/references/tokens.md):
 *   verde = activo/resuelto/éxito · naranja = pendiente/advertencia
 *   rojo  = inactivo/error        · gris    = neutro
 *
 * Centralizar el mapeo evita que cada vista invente su propio color
 * (el bug histórico: "Resuelto" en azul y "Pendiente" en rojo).
 */
const TONE_BY_STATUS: Record<string, StatusTone> = {
  // Éxito / operativo
  resuelto: "success",
  completado: "success",
  confirmado: "success",
  operativo: "success",
  activo: "success",
  disponible: "success",
  "en ruta": "success",
  // Pendiente / en curso
  pendiente: "pending",
  programado: "pending",
  "en curso": "pending",
  "en proceso": "pending",
  "en revision": "pending",
  "en revisión": "pending",
  retraso: "pending",
  mantenimiento: "pending",
  // Error / inactivo
  critico: "danger",
  crítico: "danger",
  cancelado: "danger",
  inactivo: "danger",
  rechazado: "danger",
  "fuera de servicio": "danger",
  averiado: "danger",
};

export function statusTone(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  return TONE_BY_STATUS[String(status).trim().toLowerCase()] ?? "neutral";
}

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: React.ReactNode }) {
  const tone = statusTone(status);
  return <span className={`badge ${tone}`}>{label ?? status ?? "—"}</span>;
}

export default StatusBadge;
