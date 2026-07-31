import React, { useEffect, useMemo, useState } from "react";
import { Bootstrap, Monitor } from "../types";
import { Icon, IconName } from "../components/Icon";
import { MetricCard, MetricTone } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { MapView } from "../components/MapView";

export function Dashboard({ data, monitor }: { data: Bootstrap; monitor: Monitor }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setTick(value => value + 1), 5000);
    return () => window.clearInterval(interval);
  }, []);

  const effectiveData = { ...data, ...monitor } as Bootstrap;

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

  const dispatchBoard = useMemo(() => {
    if (monitor.truck_assignments?.length) {
      return monitor.truck_assignments.slice(0, 3).map((assignment, index) => ({
        hour: `0${8 + index}:00`,
        zone: assignment.zone,
        truck: assignment.truck_code,
        action: assignment.action ?? `Atender ${assignment.zone}`,
        status: index === tick % 3 ? "En curso" : index < tick % 3 ? "Completado" : "Programado"
      }));
    }

    const prioritized = [...(effectiveData.prioritized_zones ?? [])].sort((a, b) => b.priority_score - a.priority_score);
    const routes = [...(effectiveData.optimized_routes ?? effectiveData.routes ?? [])].sort((a, b) => {
      const aUrgency = /retraso/i.test(a.delay) || a.progress < 40 ? 1 : 0;
      const bUrgency = /retraso/i.test(b.delay) || b.progress < 40 ? 1 : 0;
      return bUrgency - aUrgency || b.progress - a.progress;
    });

    const sequence = [
      { hour: "08:00", zone: prioritized[0]?.name ?? "Centro Historico", truck: routes[0]?.truck ?? "C-02", action: "Despacho inicial" },
      { hour: "09:00", zone: prioritized[1]?.name ?? "Wanchaq", truck: routes[1]?.truck ?? "C-01", action: "Revisión de contenedores" },
      { hour: "10:00", zone: prioritized[2]?.name ?? "Santiago", truck: routes[2]?.truck ?? "C-03", action: "Atención de reporte" }
    ];

    return sequence.map((step, index) => ({
      ...step,
      status: index === tick % 3 ? "En curso" : index < tick % 3 ? "Completado" : "Programado"
    }));
  }, [monitor.truck_assignments, effectiveData.prioritized_zones, effectiveData.optimized_routes, effectiveData.routes, tick]);

  const alerts = (monitor.alerts ?? []).map((alert, index) => ({
    id: index,
    title: alert,
    time: "Ahora",
    status: alert.toLowerCase().includes("retraso") ? "pendiente" : "activo"
  }));

  return (
    <>
      <div className="metrics-grid">
        {metrics.map(metric => (
          <MetricCard key={metric.label} icon={<Icon name={metric.icon} />} tone={metric.tone} value={metric.value} label={metric.label} />
        ))}
      </div>

      <div className="dashboard-sections">
        <Panel icon={<Icon name="map" />} title="Mapa Operativo" className="full-width">
          <MapView zones={data.zones} trucks={effectiveData.trucks} routes={effectiveData.optimized_routes ?? effectiveData.routes} prioritizedZones={effectiveData.prioritized_zones ?? []} />
        </Panel>
        <Panel icon={<Icon name="truck" />} title="Tablero de despacho">
          <div className="dispatch-board">
            {dispatchBoard.map(step => (
              <div className="dispatch-card" key={step.hour}>
                <h4>{step.hour}</h4>
                <div className="dispatch-zone">{step.zone}</div>
                <div style={{fontSize:13,color:'var(--muted)'}}>{step.action} · {step.truck}</div>
                <div className="dispatch-progress">
                  <div className="progress-bar"><div className="progress-bar-fill" style={{width: step.status === 'Completado' ? '100%' : step.status === 'En curso' ? '50%' : '10%'}}></div></div>
                  <span style={{color: step.status === 'Completado' ? 'var(--success)' : step.status === 'En curso' ? 'var(--mustard-500)' : 'var(--muted-light)', fontWeight:600, fontSize:11}}>{step.status}</span>
                </div>
              </div>
            ))}
          </div>
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
              <p style={{ color: "var(--muted)", padding: "12px 0", fontSize:13 }}>No hay acciones de intervención prioritarias definidas.</p>
            )}
          </div>
        </Panel>

        <Panel icon={<Icon name="bell" />} title="Alertas Activas">
          <div className="alert-list">
            {alerts.map(alert => (
              <div className={`alert-item alert-${alert.status}`} key={alert.id}>
                <Icon name="bell" />
                <div className="alert-message">
                  <div>{alert.title}</div>
                </div>
                <span className="alert-time">{alert.time}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

export default Dashboard;
