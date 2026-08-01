import React, { useEffect, useMemo, useState } from "react";
import { Report, ReportStatus, Truck } from "../types";
import { DataTable, Column } from "./DataTable";
import { Toolbar, FilterSelect } from "./Toolbar";
import { toOptions } from "../constants";
import { Pagination, paginate } from "./Pagination";
import { StatusBadge } from "./StatusBadge";

const PAGE_SIZE = 8;

export function ReportList({ reports, trucks = [], showDriverFilter = false, showResolve = false, onResolveReport }: { reports: Report[]; trucks?: Truck[]; showDriverFilter?: boolean; showResolve?: boolean; onResolveReport?: (id: number) => Promise<void>; }) {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

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

  const filtered = useMemo(() => reports.filter(report => {
    const reportDriver = driverByZone[String(report.zone ?? "").toLowerCase()] ?? "";
    const matchStatus = !filterStatus || report.status === filterStatus;
    const matchZone = !zoneFilter || report.zone === zoneFilter;
    const matchDriver = !driverFilter || reportDriver === driverFilter.toLowerCase();
    return matchStatus && matchZone && matchDriver;
  }), [reports, filterStatus, zoneFilter, driverFilter, driverByZone]);

  // Al cambiar los filtros, volver a la primera página para no quedar en una vacía.
  useEffect(() => { setPage(1); }, [filterStatus, zoneFilter, driverFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  // Catálogos derivados de los datos visibles.
  const statusOptions = toOptions(["Pendiente", "En revision", "Resuelto"]);
  const zoneOptions = useMemo(() => toOptions([...new Set(reports.map(report => report.zone).filter(Boolean))] as string[]), [reports]);
  const driverOptions = useMemo(
    () => toOptions([...new Set(trucks.map(truck => truck.driver).filter(Boolean))] as string[]),
    [trucks]
  );

  const columns: Column<Report>[] = [
    { key: "type", header: "Tipo", render: report => <strong>{report.type}</strong> },
    { key: "zone", header: "Zona", render: report => report.zone },
    { key: "citizen", header: "Ciudadano", render: report => report.citizen },
    {
      key: "driver",
      header: "Conductor",
      render: report => driverByZone[String(report.zone ?? "").toLowerCase()] ?? "Sin conductor asignado",
    },
    { key: "detail", header: "Detalle", render: report => report.detail },
    { key: "status", header: "Estado", render: report => <StatusBadge status={report.status} /> },
  ];

  if (showResolve && onResolveReport) {
    columns.push({
      key: "actions",
      header: "",
      align: "right",
      render: report =>
        report.status === "Resuelto" ? null : (
          <div className="table-actions">
            <button
              type="button"
              className="btn sm"
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
          </div>
        ),
    });
  }

  return (
    <div className="listing">
      <Toolbar
        filters={
          <>
            <FilterSelect label="Estado" value={filterStatus} onChange={setFilterStatus} options={statusOptions} allLabel="Todos" />
            <FilterSelect label="Zona" value={zoneFilter} onChange={setZoneFilter} options={zoneOptions} allLabel="Todas" />
            {showDriverFilter && (
              <FilterSelect label="Conductor" value={driverFilter} onChange={setDriverFilter} options={driverOptions} allLabel="Todos" />
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={report => report.id}
        caption="Listado de reportes ciudadanos"
        emptyMessage="No hay reportes que coincidan con tu búsqueda"
      />

      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />
    </div>
  );
}

export default ReportList;
