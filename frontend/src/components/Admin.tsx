import React, { useState } from "react";
import { Bootstrap, OperationUpdatePayload } from "../types";
import { UserPanel } from "./admin/UserPanel";
import { ZonePanel } from "./admin/ZonePanel";
import { SchedulePanel } from "./admin/SchedulePanel";
import { TruckPanel } from "./admin/TruckPanel";
import { MaintenancePanel } from "./admin/MaintenancePanel";
import { EventsPanel } from "./admin/EventsPanel";
import { TrackingPanel } from "./admin/TrackingPanel";

const TABS = ["Usuarios", "Zonas", "Horarios", "Camiones", "Mantenimiento", "Seguimiento", "Eventos"] as const;
type AdminTab = typeof TABS[number];

/**
 * Administración por pestañas.
 *
 * Antes los seis paneles se apilaban a la vez: cada uno con su acción primaria
 * en el acento sólido, lo que dejaba seis acentos compitiendo en una sola vista
 * (el sistema admite uno) y convertía la pantalla en un muro de formularios.
 * Con pestañas solo hay una acción principal visible a la vez.
 *
 * La resolución de incidencias vive en la vista de Reportes.
 */
export default function Admin({ data, onOperationUpdate }: { data: Bootstrap; onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>; }) {
  const [tab, setTab] = useState<AdminTab>("Usuarios");

  return (
    <div className="admin-view">
      <div className="tabs" role="tablist" aria-label="Secciones de administración">
        {TABS.map(item => (
          <button
            key={item}
            role="tab"
            type="button"
            id={`admin-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`admin-panel-${item}`}
            className={`tab ${tab === item ? "active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
        {tab === "Usuarios" && <UserPanel users={data.users ?? []} zones={data.zones ?? []} />}
        {tab === "Zonas" && <ZonePanel zones={data.zones ?? []} />}
        {tab === "Horarios" && <SchedulePanel zones={data.zones ?? []} schedules={data.schedules ?? []} />}
        {tab === "Camiones" && <TruckPanel zones={data.zones ?? []} trucks={data.trucks ?? []} />}
        {tab === "Mantenimiento" && <MaintenancePanel trucks={data.trucks ?? []} maintenance={data.maintenance ?? []} />}
        {tab === "Seguimiento" && <TrackingPanel zones={data.zones ?? []} />}
        {tab === "Eventos" && <EventsPanel routes={data.routes ?? []} containers={data.containers ?? []} onOperationUpdate={onOperationUpdate} />}
      </div>
    </div>
  );
}
