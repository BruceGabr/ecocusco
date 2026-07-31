import React, { FormEvent, useState } from "react";
import { Bootstrap, Report, Session } from "../types";
import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import { ReportList } from "../components/ReportList";
import { exportToCSV, exportToPDF } from "../utils/export";

export function Reports({ data, session, onCreateReport, onResolveReport }: { data: Bootstrap; session: Session; onCreateReport: (report: Omit<Report, "id" | "status">) => Promise<void>; onResolveReport: (id: number) => Promise<void>; }) {
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await onCreateReport({
        citizen: session.name,
        zone: String(form.get("zone")),
        type: String(form.get("type")),
        detail: String(form.get("detail")).trim()
      });
      event.currentTarget.reset();
    } finally {
      setSubmitting(false);
    }
  }
  const isCitizen = session.role === "ciudadano";
  const canResolve = session.role === "operador" || session.role === "admin";

  return (
    <div className="two-col">
      <Panel icon={<Icon name="reports" />} title="Registrar incidencia">
        <form className="form-grid" onSubmit={submit}>
          <label>Zona<select name="zone">{data.zones.map(zone => <option key={zone.id}>{zone.name}</option>)}</select></label>
          <label>Tipo<select name="type"><option>Acumulacion de basura</option><option>Retraso</option><option>Contenedor lleno</option><option>Otro</option></select></label>
          <label className="wide">Detalle<textarea name="detail" required minLength={8} maxLength={600} placeholder="Describe el problema encontrado" /></label>
          <button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Enviar reporte"}</button>
        </form>
      </Panel>
      <Panel
        icon={<Icon name="reports" />}
        title={isCitizen ? "Mis reportes" : "Seguimiento"}
        actions={
          <>
            <button type="button" className="action-btn" onClick={() => exportToCSV("reportes", data.reports)}>
              <Icon name="download" /> CSV
            </button>
            <button type="button" className="action-btn" onClick={() => exportToPDF("Reportes", data.reports.map(report => `<div class="report-card"><h2>${report.type}</h2><div class="tag">${report.status}</div><p><strong>Zona:</strong> ${report.zone}</p><p><strong>Ciudadano:</strong> ${report.citizen}</p><p>${report.detail}</p></div>`).join(""))}>
              <Icon name="download" /> PDF
            </button>
          </>
        }
      >
        {isCitizen && <p style={{ color: "var(--muted)", marginBottom: "12px" }}>Como ciudadano, esta vista muestra solo tus reportes.</p>}
        <ReportList reports={data.reports} trucks={data.trucks} showDriverFilter={!isCitizen} showResolve={canResolve} onResolveReport={onResolveReport} />
      </Panel>
    </div>
  );
}

export default Reports;
