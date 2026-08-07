import React, { useMemo } from "react";
import { Bootstrap, Monitor, Session } from "../types";
import { Icon, IconName } from "../components/Icon";
import { MetricCard, MetricTone } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import { MapView } from "../components/MapView";
import { StatusBadge } from "../components/StatusBadge";
import { ProximityPanel } from "../components/ProximityPanel";
import { useHealth } from "../hooks/useHealth";
import { CONTAINER_FILL_CRITICAL } from "../constants";

export function Dashboard({ data, monitor, session }: { data: Bootstrap; monitor: Monitor; session: Session }) {
  const effectiveData = { ...data, ...monitor } as Bootstrap;
  const proximityAlerts = monitor.proximity_alerts ?? [];
  const isAdmin = session.role === "admin";
  const health = useHealth(isAdmin);

  // Zona del usuario: se resalta en el mapa junto al radio de proximidad.
  const focusZone = useMemo(
    () => data.zones.find(zone => zone.name.trim().toLowerCase() === String(session.zone ?? "").trim().toLowerCase()),
    [data.zones, session.zone]
  );

  const nearbyTruckCodes = useMemo(
    () => proximityAlerts.map(alert => alert.truck_code).filter(Boolean) as string[],
    [proximityAlerts]
  );

  type MetricEntry = { value: React.ReactNode; label: string; icon: IconName; tone: MetricTone };
  const metrics: MetricEntry[] = [
    { value: effectiveData.analytics.zones, label: "Zonas Activas", icon: "map", tone: "green" },
    { value: effectiveData.analytics.active_trucks, label: "Camiones en Ruta", icon: "truck", tone: "sage" },
    { value: effectiveData.analytics.open_reports, label: "Alertas Pendientes", icon: "alert", tone: "mustard" },
    { value: `${effectiveData.analytics.confirmed_collections}/${data.collections.length}`, label: "Recolecciones", icon: "check", tone: "green" },
    ...(monitor.performance ? [
      { value: monitor.performance.delayed_routes ?? 0, label: "Rutas con retraso", icon: "bell" as IconName, tone: "mustard" as MetricTone },
      { value: `${monitor.performance.average_progress ?? 0}%`, label: "Progreso medio", icon: "dashboard" as IconName, tone: "sage" as MetricTone },
      { value: monitor.performance.compliance_estimate ?? "-", label: "Índice de cumplimiento", icon: "check" as IconName, tone: "green" as MetricTone }
    ] : [])
  ];

  /**
   * Tablero de despacho.
   *
   * Sale de las asignaciones que calcula el backend y del avance real de cada
   * ruta. Antes se inventaba: horas fijas 08:00/09:00/10:00, estados rotando
   * con un contador cada 5 segundos y, si no había datos, una secuencia con
   * zonas y camiones escritos a mano. Se veía movimiento donde no lo había.
   */
  const dispatchBoard = useMemo(() => {
    const routes = effectiveData.optimized_routes ?? effectiveData.routes ?? [];
    const routeById = new Map(routes.map(route => [route.id, route]));
    return (monitor.truck_assignments ?? []).map(assignment => {
      const route = routeById.get(assignment.route_id);
      const progress = route?.progress ?? 0;
      const status = progress >= 100 ? "Completado" : progress > 0 ? "En curso" : "Programado";
      return {
        key: `${assignment.route_id}-${assignment.truck_code}`,
        zone: assignment.zone,
        truck: assignment.truck_code,
        action: assignment.action,
        eta: assignment.eta,
        priority: assignment.priority,
        progress,
        status
      };
    });
  }, [monitor.truck_assignments, effectiveData.optimized_routes, effectiveData.routes]);

  const alerts = monitor.alerts ?? [];

  return (
    <>
      <div className="metrics-grid">
        {metrics.map(metric => (
          <MetricCard key={metric.label} icon={<Icon name={metric.icon} />} tone={metric.tone} value={metric.value} label={metric.label} />
        ))}
      </div>

      <div className="dashboard-sections">
        <Panel icon={<Icon name="truck" />} title="Camiones cercanos" className="full-width">
          <ProximityPanel alerts={proximityAlerts} role={session.role} zone={session.zone} />
        </Panel>

        <Panel icon={<Icon name="map" />} title="Mapa Operativo" className="full-width">
          <MapView
            zones={data.zones}
            trucks={effectiveData.trucks}
            routes={effectiveData.optimized_routes ?? effectiveData.routes}
            prioritizedZones={effectiveData.prioritized_zones ?? []}
            focusZone={focusZone}
            nearbyTruckCodes={nearbyTruckCodes}
          />
        </Panel>

        <Panel icon={<Icon name="truck" />} title="Tablero de despacho">
          {dispatchBoard.length === 0 ? (
            <EmptyState message="No hay asignaciones de despacho activas." />
          ) : (
            <div className="dispatch-board">
              {dispatchBoard.map(step => (
                <div className="dispatch-card" key={step.key}>
                  <h4>{step.truck} · {step.zone}</h4>
                  <div className="dispatch-zone">{step.action}</div>
                  <div className="dispatch-zone">ETA {step.eta} · Prioridad {step.priority}</div>
                  <div className="dispatch-progress">
                    <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${step.progress}%` }}></div></div>
                    <StatusBadge status={step.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel icon={<Icon name="alert" />} title="Plan de intervención">
          <div className="alert-list">
            {(effectiveData.intervention_plan ?? []).map((step, index) => (
              <div className="alert-item alert-activo" key={`${step.title}-${index}`}>
                <Icon name="alert" />
                <div className="alert-message">
                  <strong>{step.title}</strong>
                  <div>{step.detail}</div>
                </div>
                <span className="alert-time">Prioridad {step.priority}</span>
              </div>
            ))}
            {(effectiveData.intervention_plan ?? []).length === 0 && (
              <EmptyState message="No hay acciones de intervención prioritarias definidas." />
            )}
          </div>
        </Panel>

        {isAdmin && (
          <Panel icon={<Icon name="dashboard" />} title="Estado del sistema">
            <dl className="detail-list">
              <dt>Origen de los datos</dt>
              <dd>
                {health
                  ? health.mode === "production"
                    ? `Producción · ${health.database}`
                    : `Demostración · ${health.database}`
                  : "No se pudo consultar el estado del servicio"}
              </dd>
              <dt>Versión de la API</dt>
              <dd>{health?.version ?? "—"}</dd>
              <dt>Catálogos</dt>
              <dd>
                {data.users?.length ?? 0} usuarios · {data.zones.length} zonas · {data.trucks.length} camiones
              </dd>
              <dt>Incidencias abiertas</dt>
              <dd>{effectiveData.analytics.open_reports}</dd>
              <dt>Rutas con retraso</dt>
              <dd>{monitor.performance?.delayed_routes ?? 0}</dd>
              <dt>Contenedores críticos</dt>
              <dd>
                {(effectiveData.containers ?? []).filter(container => container.fill_level >= CONTAINER_FILL_CRITICAL).length}
                {" "}con llenado ≥ {CONTAINER_FILL_CRITICAL}%
              </dd>
            </dl>
          </Panel>
        )}

        <Panel icon={<Icon name="bell" />} title="Alertas Activas">
          <div className="alert-list">
            {alerts.map((alert, index) => (
              <div className={`alert-item ${/retraso|pendiente/i.test(alert) ? "alert-pendiente" : "alert-activo"}`} key={`${alert}-${index}`}>
                <Icon name="bell" />
                <div className="alert-message">
                  <div>{alert}</div>
                </div>
              </div>
            ))}
            {alerts.length === 0 && <EmptyState message="No hay alertas operativas activas." />}
          </div>
        </Panel>
      </div>
    </>
  );
}

export default Dashboard;
