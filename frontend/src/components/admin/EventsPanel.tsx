import React, { FormEvent, useState } from "react";
import { OperationUpdatePayload, Route } from "../../types";
import { Panel } from "../Panel";

type Container = { id: number; zone_id: number; name: string; fill_level: number; status: string; updated_at: string };

export function EventsPanel({ routes, containers, onOperationUpdate }: { routes: Route[]; containers: Container[]; onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>; }) {
  const [eventType, setEventType] = useState<"route_update" | "container_update">("route_update");
  const [eventTargetId, setEventTargetId] = useState<number>(routes?.[0]?.id ?? containers?.[0]?.id ?? 0);
  const [eventProgress, setEventProgress] = useState("");
  const [eventDelay, setEventDelay] = useState("");
  const [eventFillLevel, setEventFillLevel] = useState("");
  const [eventStatus, setEventStatus] = useState("");
  const [eventNote, setEventNote] = useState("");

  async function submitEventUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: OperationUpdatePayload = {
      type: eventType,
      id: eventTargetId,
      note: eventNote.trim() || undefined,
    };

    if (eventType === "route_update") {
      if (eventProgress.trim()) payload.progress = Number(eventProgress);
      if (eventDelay.trim()) payload.delay = eventDelay;
    } else {
      if (eventFillLevel.trim()) payload.fill_level = Number(eventFillLevel);
      if (eventStatus.trim()) payload.status = eventStatus;
    }

    await onOperationUpdate(payload);
    setEventProgress("");
    setEventDelay("");
    setEventFillLevel("");
    setEventStatus("");
    setEventNote("");
  }

  return (
    <Panel title="Eventos operativos">
      <p>Envía actualizaciones de ruta y contenedor desde el panel administrativo.</p>
      <form className="form-grid" onSubmit={submitEventUpdate}>
        <label htmlFor="event-type">Tipo de evento<select id="event-type" value={eventType} onChange={event => setEventType(event.currentTarget.value as "route_update" | "container_update")}>
          <option value="route_update">Actualización de ruta</option>
          <option value="container_update">Actualización de contenedor</option>
        </select></label>
        <label htmlFor="event-target">Objetivo<select id="event-target" value={eventTargetId} onChange={event => setEventTargetId(Number(event.currentTarget.value))}>
          {eventType === "route_update"
            ? routes?.map((route, index) => <option key={`route-${route.id}-${index}`} value={route.id}>{`Ruta ${route.truck} - ${route.zone}`}</option>)
            : containers?.map((container, index) => <option key={`container-${container.id}-${index}`} value={container.id}>{`${container.name} (${container.fill_level}%)`}</option>)}
        </select></label>
        {eventType === "route_update" ? (
          <>
            <label htmlFor="event-progress">Progreso<input id="event-progress" name="progress" value={eventProgress} onChange={event => setEventProgress(event.currentTarget.value)} placeholder="Ej. 92" /></label>
            <label htmlFor="event-delay">Retraso<input id="event-delay" name="delay" value={eventDelay} onChange={event => setEventDelay(event.currentTarget.value)} placeholder="Retraso leve" /></label>
          </>
        ) : (
          <>
            <label htmlFor="event-fill">Llenado<input id="event-fill" name="fill_level" value={eventFillLevel} onChange={event => setEventFillLevel(event.currentTarget.value)} placeholder="95" /></label>
            <label htmlFor="event-status">Estado<input id="event-status" name="status" value={eventStatus} onChange={event => setEventStatus(event.currentTarget.value)} placeholder="Lleno" /></label>
          </>
        )}
        <label htmlFor="event-note" className="wide">Nota<textarea id="event-note" value={eventNote} onChange={event => setEventNote(event.currentTarget.value)} placeholder="Detalle de la acción..." /></label>
        <button type="submit">Enviar evento</button>
      </form>
    </Panel>
  );
}

export default EventsPanel;
