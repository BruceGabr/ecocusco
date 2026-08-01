import React, { FormEvent, useEffect, useState } from "react";
import { Bootstrap, Report, Session } from "../types";
import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import { Select } from "../components/Select";
import { ReportList } from "../components/ReportList";
import { REPORT_TYPES, toOptions } from "../constants";
import { collectErrors, errorProps, FieldErrors } from "../utils/validation";
import { exportToCSV, exportToPDF } from "../utils/export";

export function Reports({ data, session, onCreateReport, onResolveReport }: { data: Bootstrap; session: Session; onCreateReport: (report: Omit<Report, "id" | "status">) => Promise<void>; onResolveReport: (id: number) => Promise<void>; }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [zone, setZone] = useState("");
  const [type, setType] = useState<string>(REPORT_TYPES[0]);

  useEffect(() => {
    if (!zone && data.zones.length) setZone(data.zones[0].name);
  }, [data.zones, zone]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Se guarda la referencia al form: React anula event.currentTarget al
    // terminar el handler, así que usarlo tras el await lanzaría TypeError.
    const formElement = event.currentTarget;
    const found = collectErrors(formElement);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    const form = new FormData(formElement);
    setSubmitting(true);
    setError("");
    try {
      await onCreateReport({
        citizen: session.name,
        zone,
        type,
        detail: String(form.get("detail")).trim()
      });
      formElement.reset();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo registrar el reporte");
    } finally {
      setSubmitting(false);
    }
  }
  const isCitizen = session.role === "ciudadano";
  const canResolve = session.role === "operador" || session.role === "admin";

  return (
    <div className="two-col reports-layout">
      <Panel icon={<Icon name="reports" />} title="Registrar incidencia">
        <form className="form-grid" onSubmit={submit} noValidate>
          <label htmlFor="report-zone">Zona<Select id="report-zone" value={zone} onChange={setZone} options={data.zones.map(item => ({ value: item.name, label: item.name }))} placeholder="Selecciona una zona" /></label>
          <label htmlFor="report-type">Tipo<Select id="report-type" value={type} onChange={setType} options={toOptions(REPORT_TYPES)} /></label>
          <label className="wide" htmlFor="report-detail">Detalle<textarea id="report-detail" name="detail" required minLength={8} maxLength={600} placeholder="Describe el problema encontrado" {...errorProps("report-detail", errors)} />
            {errors["report-detail"] && <span className="field-error" id="report-detail-error">{errors["report-detail"]}</span>}</label>
          <button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Enviar reporte"}</button>
        </form>
        {error && <p className="hint error" role="alert">{error}</p>}
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
