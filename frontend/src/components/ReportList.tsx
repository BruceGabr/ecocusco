import React, { useMemo, useState } from "react";
import { Report, ReportStatus, Truck } from "../types";
import { Icon } from "./Icon";
import { EmptyState } from "./EmptyState";

function statusTone(status: string) {
  if (status === "Resuelto") return "blue";
  if (status === "En revision") return "yellow";
  return "red";
}

function reportStatusLabel(status: string) {
  return status === "Pendiente" ? "Pendiente" : status;
}

export function ReportList({ reports, trucks = [], showDriverFilter = false, showResolve = false, onResolveReport }: { reports: Report[]; trucks?: Truck[]; showDriverFilter?: boolean; showResolve?: boolean; onResolveReport?: (id: number) => Promise<void>; }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [driverSearch, setDriverSearch] = useState("");
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const driverByZone = useMemo(() => {
    const map: Record<string, string> = {};
    trucks.forEach(truck => {
      const zoneKey = String(truck.zone ?? "").toLowerCase();
      if (!map[zoneKey] && truck.driver) {
        map[zoneKey] = truck.driver.toLowerCase();
      }
    });
    return map;
  }, [trucks]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    const normalizedDriver = driverSearch.toLowerCase().trim();

    return reports.filter(r => {
      const reportDriver = driverByZone[String(r.zone ?? "").toLowerCase()] ?? "";
      const searchable = `${r.type ?? ""} ${r.zone ?? ""} ${r.citizen ?? ""} ${r.detail ?? ""} ${reportDriver}`.toLowerCase();
      const matchSearch = searchable.includes(normalizedSearch);
      const matchStatus = filterStatus === "Todos" || r.status === filterStatus;
      const matchDriver = !normalizedDriver || reportDriver.includes(normalizedDriver);
      return matchSearch && matchStatus && matchDriver;
    });
  }, [reports, search, filterStatus, driverSearch, driverByZone]);

  const statuses: Array<"Todos" | ReportStatus> = ["Todos", "Pendiente", "En revision", "Resuelto"];

  return (
    <div>
      <div className="search-box">
        <Icon name="search" />
        <input
          type="text"
          placeholder="Buscar reporte..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar reportes"
        />
      </div>
      {showDriverFilter && (
        <div className="search-box" style={{ marginTop: '10px' }}>
          <Icon name="search" />
          <input
            type="text"
            placeholder="Buscar por conductor..."
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            aria-label="Buscar reportes por conductor"
          />
        </div>
      )}

      <div className="filter-bar">
        {statuses.map(status => (
          <button key={status} type="button" className={`filter-btn ${filterStatus === status ? "active" : ""}`} onClick={() => setFilterStatus(status)} aria-pressed={filterStatus === status}>
            {status}
          </button>
        ))}
      </div>

      <div className="list">
        {filtered.length === 0 ? (
          <EmptyState message="No hay reportes que coincidan con tu búsqueda" />
        ) : (
          filtered.map(report => {
            const reportDriver = driverByZone[String(report.zone ?? "").toLowerCase()] ?? "Sin conductor asignado";
            return (
              <article className="item" key={report.id}>
                <div className="item-row">
                  <strong>{report.type}</strong>
                  <span className={`tag ${statusTone(report.status)}`}>
                    {reportStatusLabel(report.status)}
                  </span>
                </div>
                <span>{report.zone} | {report.citizen} | {reportDriver}</span>
                <p>{report.detail}</p>
                {showResolve && report.status !== "Resuelto" && onResolveReport && (
                  <button
                    type="button"
                    className="action-btn"
                    onClick={async () => {
                      setResolvingId(report.id);
                      try {
                        await onResolveReport(report.id);
                      } finally {
                        setResolvingId(null);
                      }
                    }}
                    disabled={resolvingId === report.id}
                  >
                    {resolvingId === report.id ? "Resolviendo..." : "Marcar resuelto"}
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ReportList;
