import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Schedule, Zone } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { DataTable, Column } from "../DataTable";
import { Toolbar, FilterSelect } from "../Toolbar";
import { Pagination, paginate } from "../Pagination";
import { Select } from "../Select";
import { TimePicker, formatTimeLabel } from "../TimePicker";
import { WASTE_TYPES, WEEK_DAYS, toOptions } from "../../constants";

const PAGE_SIZE = 8;

type ScheduleForm = { zone_id: number; day: string; time: string; waste: string };

const EMPTY_FORM: ScheduleForm = { zone_id: 0, day: "Lunes", time: "08:00", waste: WASTE_TYPES[0] };

export function SchedulePanel({ zones, schedules: initialSchedules }: { zones: Zone[]; schedules: Schedule[] }) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules ?? []);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [page, setPage] = useState(1);

  const [zoneFilter, setZoneFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);

  useEffect(() => {
    setSchedules(initialSchedules ?? []);
  }, [initialSchedules]);

  const zoneOptions = useMemo(() => (zones ?? []).map(zone => ({ value: String(zone.id), label: zone.name })), [zones]);
  const zoneNameById = useMemo(() => {
    const map: Record<number, string> = {};
    (zones ?? []).forEach(zone => { map[zone.id] = zone.name; });
    return map;
  }, [zones]);

  // Catálogos derivados de los datos: solo se ofrecen valores que existen.
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

  function report(message: string, error = false) {
    setFeedback(message);
    setIsError(error);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, zone_id: zones?.[0]?.id ?? 0 });
    setModalOpen(true);
  }

  function openEdit(schedule: Schedule) {
    setEditingId(schedule.id);
    setForm({
      zone_id: schedule.zone_id ?? (zones ?? []).find(zone => zone.name === schedule.zone)?.id ?? 0,
      day: schedule.day,
      time: schedule.time,
      waste: schedule.waste,
    });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.zone_id) {
      report("Selecciona una zona válida", true);
      return;
    }
    try {
      if (editingId === null) {
        // El backend espera zone_id numérico; antes se enviaba el nombre de la
        // zona y la creación fallaba con 422.
        const created = await request<Schedule>('/schedules', { method: 'POST', body: JSON.stringify(form) });
        setSchedules(prev => [...prev, created]);
        report(`Horario creado para ${created.zone ?? zoneNameById[form.zone_id]}`);
      } else {
        const updated = await request<Schedule>(`/schedules/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) });
        setSchedules(prev => prev.map(item => item.id === editingId ? { ...item, ...updated } : item));
        report(`Horario actualizado para ${updated.zone ?? zoneNameById[form.zone_id]}`);
      }
      setModalOpen(false);
      setEditingId(null);
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo guardar el horario', true);
    }
  }

  async function removeSchedule(schedule: Schedule) {
    try {
      await request(`/schedules/${schedule.id}`, { method: 'DELETE' });
      setSchedules(prev => prev.filter(item => item.id !== schedule.id));
      report('Horario eliminado');
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo eliminar el horario', true);
    }
  }

  const columns: Column<Schedule>[] = [
    { key: "zone", header: "Zona", render: item => <strong>{item.zone}</strong> },
    { key: "day", header: "Día", render: item => item.day },
    { key: "time", header: "Hora", render: item => formatTimeLabel(item.time) },
    { key: "waste", header: "Tipo de residuo", render: item => <span className="badge neutral">{item.waste}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: item => (
        <div className="table-actions">
          <Button size="sm" onClick={() => openEdit(item)}><Icon name="edit" size={15} /> Editar horario</Button>
          <Button size="sm" variant="danger" onClick={() => removeSchedule(item)}><Icon name="trash" size={15} /> Eliminar horario</Button>
        </div>
      ),
    },
  ];

  return (
    <Panel title="Gestión de horarios">
      <Toolbar
        filters={
          <>
            <FilterSelect label="Zona" value={zoneFilter} onChange={setZoneFilter} options={(zones ?? []).map(zone => ({ value: zone.name, label: zone.name }))} allLabel="Todas" />
            <FilterSelect label="Día" value={dayFilter} onChange={setDayFilter} options={dayOptions} allLabel="Todos" />
            <FilterSelect label="Hora" value={timeFilter} onChange={setTimeFilter} options={timeOptions} allLabel="Todas" />
          </>
        }
        action={<button type="button" className="btn primary" onClick={openCreate}>Crear horario</button>}
      />

      {feedback && <p className={`hint ${isError ? "error" : "success"}`} aria-live="polite">{feedback}</p>}

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(item, index) => `schedule-${item.id}-${index}`}
        caption="Lista de horarios"
        emptyMessage="No hay horarios registrados para este filtro"
      />
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />

      <Modal open={modalOpen} title={editingId === null ? "Nuevo horario" : "Editar horario"} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={submitForm} noValidate>
          <label htmlFor="schedule-zone">Zona<Select id="schedule-zone" value={String(form.zone_id)} onChange={value => setForm(prev => ({ ...prev, zone_id: Number(value) }))} options={zoneOptions} placeholder="Selecciona una zona" /></label>
          <label htmlFor="schedule-day">Día<Select id="schedule-day" value={form.day} onChange={value => setForm(prev => ({ ...prev, day: value }))} options={toOptions(WEEK_DAYS)} /></label>
          <label htmlFor="schedule-time">Hora<TimePicker id="schedule-time" value={form.time} onChange={value => setForm(prev => ({ ...prev, time: value }))} /></label>
          <label htmlFor="schedule-waste">Tipo de residuo<Select id="schedule-waste" value={form.waste} onChange={value => setForm(prev => ({ ...prev, waste: value }))} options={toOptions(WASTE_TYPES)} /></label>
          <div className="form-actions">
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <button type="submit" className="btn primary">{editingId === null ? "Crear horario" : "Guardar cambios"}</button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

export default SchedulePanel;
