import React, { useEffect, useMemo, useState } from "react";
import { Schedule } from "../types";
import { Icon } from "../components/Icon";
import { DataTable, Column } from "../components/DataTable";
import { Toolbar, FilterSelect } from "../components/Toolbar";
import { Pagination, paginate } from "../components/Pagination";
import { formatTimeLabel } from "../components/TimePicker";
import { toOptions } from "../constants";
import { exportToCSV } from "../utils/export";
import { NextCollectionBanner } from "../components/NextCollectionBanner";

const PAGE_SIZE = 10;

export function Schedules({ schedules, zone }: { schedules: Schedule[]; zone?: string }) {
  const [zoneFilter, setZoneFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [page, setPage] = useState(1);

  // Los catálogos salen de los datos: solo se ofrecen valores que existen,
  // en vez de una búsqueda de texto libre donde se escribía a ciegas.
  const zoneOptions = useMemo(() => toOptions([...new Set(schedules.map(item => item.zone))]), [schedules]);
  const dayOptions = useMemo(() => toOptions([...new Set(schedules.map(item => item.day))]), [schedules]);
  const timeOptions = useMemo(
    () => [...new Set(schedules.map(item => item.time))].sort().map(time => ({ value: time, label: formatTimeLabel(time) })),
    [schedules]
  );

  const filtered = useMemo(() => schedules.filter(item => {
    const matchesZone = !zoneFilter || item.zone === zoneFilter;
    const matchesDay = !dayFilter || item.day === dayFilter;
    const matchesTime = !timeFilter || item.time === timeFilter;
    return matchesZone && matchesDay && matchesTime;
  }), [schedules, zoneFilter, dayFilter, timeFilter]);

  useEffect(() => { setPage(1); }, [zoneFilter, dayFilter, timeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  const columns: Column<Schedule>[] = [
    { key: "zone", header: "Zona", render: item => <strong>{item.zone}</strong> },
    { key: "day", header: "Día", render: item => item.day },
    { key: "time", header: "Horario", render: item => formatTimeLabel(item.time) },
    { key: "waste", header: "Tipo de residuo", render: item => <span className="badge neutral">{item.waste}</span> },
  ];

  return (
    <div className="listing">
      <NextCollectionBanner schedules={schedules} zone={zone} />

      <Toolbar
        filters={
          <>
            <FilterSelect label="Zona" value={zoneFilter} onChange={setZoneFilter} options={zoneOptions} allLabel="Todas" />
            <FilterSelect label="Día" value={dayFilter} onChange={setDayFilter} options={dayOptions} allLabel="Todos" />
            <FilterSelect label="Hora" value={timeFilter} onChange={setTimeFilter} options={timeOptions} allLabel="Todas" />
          </>
        }
        action={
          <button type="button" className="btn primary" onClick={() => exportToCSV("horarios", filtered)}>
            <Icon name="download" /> Exportar CSV
          </button>
        }
      />

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={item => item.id}
        caption="Horarios de recolección por zona"
        emptyMessage="No hay horarios que coincidan con el filtro"
      />

      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />
    </div>
  );
}

export default Schedules;
