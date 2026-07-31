import React, { FormEvent, useEffect, useState } from "react";
import { Schedule, Zone } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";

export function SchedulePanel({ zones, schedules: initialSchedules }: { zones: Zone[]; schedules: Schedule[] }) {
  const [newSchedule, setNewSchedule] = useState({ zone: zones?.[0]?.name ?? "Centro Historico", day: "Lunes", time: "08:00", waste: "Orgánicos" });
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setNewSchedule(prev => ({ ...prev, zone: zones?.[0]?.name ?? prev.zone }));
  }, [zones]);

  void initialSchedules;

  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await request<Schedule>('/schedules', {
        method: 'POST',
        body: JSON.stringify(newSchedule)
      });
      setNewSchedule({ zone: zones?.[0]?.name ?? 'Centro Historico', day: 'Lunes', time: '08:00', waste: 'Orgánicos' });
      setFeedback(`Horario creado para ${created.zone}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el horario');
    }
  }

  return (
    <Panel title="Gestión de horarios">
      <p>Define y administra la programación de recolección por zona.</p>
      <form className="form-grid" onSubmit={createSchedule}>
        <label htmlFor="schedule-zone">Zona<select id="schedule-zone" value={newSchedule.zone} onChange={event => setNewSchedule(prev => ({ ...prev, zone: event.currentTarget.value }))}>{zones?.map((zone, index) => <option key={`zone-${zone.id}-${index}`} value={zone.name}>{zone.name}</option>)}</select></label>
        <label htmlFor="schedule-day">Día<select id="schedule-day" value={newSchedule.day} onChange={event => setNewSchedule(prev => ({ ...prev, day: event.currentTarget.value }))}><option>Lunes</option><option>Martes</option><option>Miércoles</option><option>Jueves</option><option>Viernes</option></select></label>
        <label htmlFor="schedule-time">Hora<input id="schedule-time" type="time" value={newSchedule.time} onChange={event => setNewSchedule(prev => ({ ...prev, time: event.currentTarget.value }))} /></label>
        <label htmlFor="schedule-waste">Tipo de residuo<input id="schedule-waste" value={newSchedule.waste} onChange={event => setNewSchedule(prev => ({ ...prev, waste: event.currentTarget.value }))} /></label>
        <button type="submit">Crear horario</button>
      </form>
      {feedback && <p className="hint success" aria-live="polite">{feedback}</p>}
    </Panel>
  );
}

export default SchedulePanel;
