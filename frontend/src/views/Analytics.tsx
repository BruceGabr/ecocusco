import React from "react";
import { Bootstrap, Session } from "../types";
import { Icon } from "../components/Icon";
import { MetricCard } from "../components/MetricCard";
import { Panel } from "../components/Panel";
import { exportToCSV, exportToPDF } from "../utils/export";

export function Analytics({ data, session, onConfirmCollection }: { data: Bootstrap; session?: Session | null; onConfirmCollection?: (id: number) => Promise<void>; }) {
  const performance = data.performance;
  const reportCounts = data.reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] ?? 0) + 1;
    return acc;
  }, { Pendiente: 0, "En revision": 0, Resuelto: 0 } as Record<string, number>);
  const collectionCounts = data.collections.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const metricsCSV = [
    { nombre: "Residuos registrados", valor: `${data.analytics.total_kg} kg` },
    { nombre: "Cumplimiento de rutas", valor: `${data.analytics.compliance}%` },
    { nombre: "Reportes abiertos", valor: data.analytics.open_reports },
    { nombre: "Camiones activos", valor: data.analytics.active_trucks },
    { nombre: "Rutas con retraso", valor: performance?.delayed_routes ?? 0 },
    { nombre: "Progreso medio", valor: `${performance?.average_progress ?? 0}%` },
    { nombre: "Llenado promedio contenedores", valor: `${performance?.average_container_fill ?? 0}%` },
    { nombre: "Recolecciones confirmadas", valor: `${collectionCounts["Confirmada"] ?? 0}/${data.collections.length}` }
  ];

  return (
    <>
      <div className="metrics-grid">
        <MetricCard icon={<Icon name="truck" />} tone="sage" value={`${data.analytics.total_kg} kg`} label="Residuos registrados" />
        <MetricCard icon={<Icon name="check" />} tone="green" value={`${data.analytics.compliance}%`} label="Cumplimiento de rutas" />
        <MetricCard icon={<Icon name="alert" />} tone="mustard" value={data.analytics.open_reports} label="Reportes abiertos" />
        <MetricCard icon={<Icon name="truck" />} tone="sage" value={data.analytics.active_trucks} label="Camiones activos" />
        <MetricCard icon={<Icon name="bell" />} tone="mustard" value={performance?.delayed_routes ?? 0} label="Rutas con retraso" />
        <MetricCard icon={<Icon name="dashboard" />} tone="green" value={`${performance?.average_progress ?? 0}%`} label="Progreso medio" />
        <MetricCard icon={<Icon name="map" />} tone="sage" value={`${performance?.average_container_fill ?? 0}%`} label="Llenado promedio" />
        <MetricCard icon={<Icon name="check" />} tone="green" value={`${collectionCounts["Confirmada"] ?? 0}/${data.collections.length}`} label="Recolectas confirmadas" />
      </div>
      <Panel
        icon={<Icon name="analytics" />}
        title="Historial de recoleccion"
        actions={
          <>
            <button type="button" className="action-btn" onClick={() => exportToCSV("metricas", metricsCSV)}>
              <Icon name="download" /> Métricas CSV
            </button>
            <button type="button" className="action-btn" onClick={() => exportToPDF("Metricas", `<table><thead><tr><th>Métrica</th><th>Valor</th></tr></thead><tbody>${metricsCSV.map(item => `<tr><td>${item.nombre}</td><td>${item.valor}</td></tr>`).join("")}</tbody></table>`) }>
              <Icon name="download" /> Métricas PDF
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          <section className="panel" style={{ padding: "16px" }}>
            <h3>Resumen de reportes</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 1.8 }}>
              <li>Pendientes: <strong>{reportCounts.Pendiente}</strong></li>
              <li>En revisión: <strong>{reportCounts["En revision"]}</strong></li>
              <li>Resueltos: <strong>{reportCounts.Resuelto}</strong></li>
            </ul>
          </section>
          <section className="panel" style={{ padding: "16px" }}>
            <h3>Estado de recolecciones</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 1.8 }}>
              {Object.entries(collectionCounts).map(([status, count]) => (
                <li key={status}>{status}: <strong>{count}</strong></li>
              ))}
            </ul>
          </section>
        </div>
        <div className="list">
          {data.collections.map(item => (
            <article className="item" key={item.id}>
              <div className="item-row">
                <strong>{`${item.date} - ${item.zone}`}</strong>
                <span className={`tag ${item.status === "Confirmada" ? "green" : "yellow"}`}>{item.status}</span>
              </div>
              <span>{`${item.truck} · ${item.kg} kg`}</span>
              {session && session.role === "ciudadano" && !String(item.status).toLowerCase().includes("confirmada") && onConfirmCollection && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn-primary" onClick={() => onConfirmCollection(item.id)}>Confirmar recolección</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default Analytics;
