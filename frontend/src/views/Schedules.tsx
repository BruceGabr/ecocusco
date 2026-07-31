import React, { useMemo, useState } from "react";
import { Schedule } from "../types";
import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import { EmptyState } from "../components/EmptyState";
import Item from "../components/Item";
import { exportToCSV } from "../utils/export";

export function Schedules({ schedules }: { schedules: Schedule[] }) {
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState("Todos");

  const filtered = useMemo(() => {
    return schedules.filter(s => {
      const matchSearch = s.zone.toLowerCase().includes(search.toLowerCase());
      const matchDay = selectedDay === "Todos" || s.day === selectedDay;
      return matchSearch && matchDay;
    });
  }, [schedules, search, selectedDay]);

  const days = ["Todos", ...new Set(schedules.map(s => s.day))];

  return (
    <Panel
      icon={<Icon name="schedules" />}
      title="Consulta por zona"
      actions={<button className="action-btn" onClick={() => exportToCSV("horarios", filtered)}><Icon name="download" /> Exportar CSV</button>}
    >
      <div className="search-box">
        <Icon name="search" />
        <input
          type="text"
          placeholder="Buscar zona..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar horarios por zona"
        />
      </div>

      <div className="filter-bar">
        {days.map(day => (
          <button
            key={day}
            className={`filter-btn ${selectedDay === day ? "active" : ""}`}
            onClick={() => setSelectedDay(day)}
            aria-pressed={selectedDay === day}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="list">
        {filtered.length === 0 ? (
          <EmptyState message="No hay horarios que coincidan con tu búsqueda" />
        ) : (
          filtered.map(item => <Item key={item.id} title={item.zone} detail={`${item.day} | ${item.time} | ${item.waste}`} color="blue" />)
        )}
      </div>
    </Panel>
  );
}

export default Schedules;
