import React from "react";
import { ProximityAlert, Role } from "../types";
import { EmptyState } from "./EmptyState";

/**
 * Avisos de proximidad, con el texto vacío ajustado al rol.
 *
 * El backend decide qué mide cada uno: el ciudadano ve camiones acercándose a
 * su zona, el conductor ve las zonas de las que está cerca y los perfiles
 * operativos ven todas las parejas camión-zona.
 */
export function ProximityPanel({
  alerts,
  role,
  zone,
}: {
  alerts: ProximityAlert[];
  role: Role;
  zone?: string;
}) {
  if (alerts.length === 0) {
    const message =
      role === "conductor"
        ? "No estás cerca de ninguna zona de recolección en este momento."
        : role === "ciudadano"
          ? `No hay camiones cerca de ${zone || "tu zona"} en este momento.`
          : "Ningún camión está cerca de una zona en este momento.";
    return <EmptyState message={message} />;
  }

  return (
    <div className="proximity-list">
      {alerts.map(alert => (
        <article className={`proximity-card ${alert.tone}`} key={alert.id}>
          <span className="proximity-truck">
            {alert.truck_code ? `${alert.truck_code} · ${alert.zone}` : alert.zone}
          </span>
          <span className="proximity-distance">{Math.round(alert.distance_m)} m</span>
          <span className="proximity-detail">
            {alert.driver ? `${alert.driver} · ` : ""}ETA {alert.eta}
            {alert.tone === "muy_cercano" ? " · Muy cercano" : ""}
          </span>
        </article>
      ))}
    </div>
  );
}

export default ProximityPanel;
