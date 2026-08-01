import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { OperationUpdatePayload, Route } from "../../types";
import { Panel } from "../Panel";
import { Select } from "../Select";

type Container = { id: number; zone_id: number; name: string; fill_level: number; status: string; updated_at: string };

export function EventsPanel({ routes, containers, onOperationUpdate }: { routes: Route[]; containers: Container[]; onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>; }) {
  const [eventType, setEventType] = useState<"route_update" | "container_update">("route_update");
  const [eventTargetId, setEventTargetId] = useState<number>(routes?.[0]?.id ?? containers?.[0]?.id ?? 0);
  const [eventProgress, setEventProgress] = useState("");
  const [eventDelay, setEventDelay] = useState("");
  const [eventFillLevel, setEventFillLevel] = useState("");
  const [eventStatus, setEventStatus] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const targets = useMemo(
    () => (eventType === "route_update" ? routes ?? [] : containers ?? []),
    [eventType, routes, containers]
  );

  // El objetivo debe pertenecer siempre a la lista del tipo activo: al cambiar
  // de ruta a contenedor (o al cargar los datos) el id anterior deja de ser
  // válido y se enviaría un evento contra un objetivo inexistente.
  useEffect(() => {
    if (!targets.length) return;
    if (!targets.some(target => target.id === eventTargetId)) {
      setEventTargetId(targets[0].id);
    }
  }, [targets, eventTargetId]);

  async function submitEventUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targets.length) {
      setFeedback("No hay objetivos disponibles para este tipo de evento.");
      return;
    }
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

    setSubmitting(true);
    setFeedback("");
    try {
      await onOperationUpdate(payload);
      setEventProgress("");
      setEventDelay("");
      setEventFillLevel("");
      setEventStatus("");
      setEventNote("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo registrar el evento operativo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Eventos operativos">
      <form className="form-grid" onSubmit={submitEventUpdate}>
        <label htmlFor="event-type">Tipo de evento<Select
          id="event-type"
          value={eventType}
          onChange={value => setEventType(value as "route_update" | "container_update")}
          options={[
            { value: "route_update", label: "Actualización de ruta" },
            { value: "container_update", label: "Actualización de contenedor" },
          ]}
        /></label>
        <label htmlFor="event-target">Objetivo<Select
          id="event-target"
          value={String(eventTargetId)}
          onChange={value => setEventTargetId(Number(value))}
          options={eventType === "route_update"
            ? (routes ?? []).map(route => ({ value: String(route.id), label: `Ruta ${route.truck} - ${route.zone}` }))
            : (containers ?? []).map(container => ({ value: String(container.id), label: `${container.name} (${container.fill_level}%)` }))}
          placeholder="Selecciona un objetivo"
        /></label>
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
        <button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Enviar evento"}</button>
      </form>
      {feedback && <p className="hint error" role="alert">{feedback}</p>}
    </Panel>
  );
}

export default EventsPanel;
