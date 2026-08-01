import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Bootstrap, Monitor } from "../types";

type NotificationRecord = NonNullable<Bootstrap["notifications"]>[number];

type Entry = {
  key: string;
  title: string;
  detail?: string;
  tone: "danger" | "pending" | "neutral";
  time?: string;
};

function toneFromType(type: string): Entry["tone"] {
  const value = (type ?? "").toLowerCase();
  if (value.includes("alert") || value.includes("critic") || value.includes("error")) return "danger";
  if (value.includes("warn") || value.includes("pend") || value.includes("retras")) return "pending";
  return "neutral";
}

function formatTime(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Módulo de notificaciones.
 *
 * Sustituye a la insignia que acompañaba al título de cada sección: repetía un
 * dato que el dashboard ya muestra como "Alertas Pendientes" y competía
 * visualmente con el encabezado de la página.
 *
 * Reúne dos fuentes: las alertas operativas en vivo del monitor y las
 * notificaciones persistidas del backend.
 */
export function NotificationsMenu({
  notifications = [],
  alerts = [],
  summary,
}: {
  notifications?: NotificationRecord[];
  alerts?: string[];
  summary?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const entries = useMemo<Entry[]>(() => {
    const fromAlerts: Entry[] = alerts.map((alert, index) => ({
      key: `alert-${index}`,
      title: alert,
      tone: /retraso|pendiente/i.test(alert) ? "pending" : "danger",
    }));
    const fromRecords: Entry[] = notifications.map(item => ({
      key: `notif-${item.id}`,
      title: item.title,
      detail: item.message,
      tone: toneFromType(item.type),
      time: formatTime(item.created_at),
    }));
    return [...fromAlerts, ...fromRecords];
  }, [alerts, notifications]);

  const unread = entries.length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="notif" ref={wrapRef}>
      <button
        type="button"
        className="notif-trigger"
        aria-label={unread ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(value => !value)}
      >
        <Icon name="bell" />
        {unread > 0 && <span className="notif-count">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notificaciones">
          <div className="notif-head">
            <strong>Notificaciones</strong>
            {summary && <span className="notif-summary">{summary}</span>}
          </div>

          {entries.length === 0 ? (
            <p className="notif-empty">No hay notificaciones pendientes.</p>
          ) : (
            <ul className="notif-list">
              {entries.map(entry => (
                <li key={entry.key} className="notif-item">
                  <span className={`notif-dot ${entry.tone}`} aria-hidden="true" />
                  <div className="notif-body">
                    <div className="notif-title">{entry.title}</div>
                    {entry.detail && <div className="notif-detail">{entry.detail}</div>}
                  </div>
                  {entry.time && <span className="notif-time">{entry.time}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationsMenu;
