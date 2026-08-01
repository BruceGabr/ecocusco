import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Bootstrap, Monitor, OperationUpdatePayload } from "../types";
import { Panel } from "../components/Panel";
import { Select } from "../components/Select";
import Item from "../components/Item";

export function Operations({ data, monitor, onOperationUpdate }: { data: Bootstrap; monitor: Monitor; onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>; }) {
  const effectiveData = { ...data, ...monitor } as Bootstrap;
  const alerts = [
    ...(effectiveData.notifications?.length ? effectiveData.notifications : data.notifications ?? []).map(item => `${item.title}: ${item.message}`),
    ...((effectiveData.containers?.length ? effectiveData.containers : data.containers ?? [])).filter(container => container.fill_level >= 80).map(container => `Contenedor ${container.name} en ${container.status}`),
    ...(effectiveData.maintenance?.length ? effectiveData.maintenance : data.maintenance ?? []).filter(item => item.status === "Pendiente").map(item => `Mantenimiento pendiente: ${item.description}`)
  ];

  const routes = (effectiveData.optimized_routes?.length ? effectiveData.optimized_routes : effectiveData.routes) ?? [];
  const containers = (effectiveData.containers?.length ? effectiveData.containers : data.containers) ?? [];
  const recentEvents = (effectiveData.notifications?.length ? effectiveData.notifications : data.notifications) ?? [];
  const [eventType, setEventType] = useState<"route_update" | "container_update">("route_update");
  // Tipo y objetivo viven en el estado: el Select propio no es un control
  // nativo y no aparece en el FormData.
  const [eventTargetId, setEventTargetId] = useState<number>(0);

  const targets = useMemo(
    () => (eventType === "route_update" ? routes : containers),
    [eventType, routes, containers]
  );

  // El objetivo debe pertenecer siempre a la lista del tipo activo.
  useEffect(() => {
    if (!targets.length) return;
    if (!targets.some(target => target.id === eventTargetId)) {
      setEventTargetId(targets[0].id);
    }
  }, [targets, eventTargetId]);

  async function submitEventUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload: OperationUpdatePayload = {
      type: eventType,
      id: eventTargetId || 0,
      note: String(formData.get("note") || "").trim() || undefined,
    };

    if (payload.type === "route_update") {
      const progressValue = formData.get("progress");
      if (progressValue) payload.progress = Number(progressValue);
      const delayValue = String(formData.get("delay") || "").trim();
      if (delayValue) payload.delay = delayValue;
    } else {
      const fillLevelValue = formData.get("fill_level");
      if (fillLevelValue) payload.fill_level = Number(fillLevelValue);
      const statusValue = String(formData.get("status") || "").trim();
      if (statusValue) payload.status = statusValue;
    }

    const form = event.currentTarget;
    await onOperationUpdate(payload);
    if (form) {
      form.reset();
    }
  }

  const topZone = (effectiveData.prioritized_zones?.length ? effectiveData.prioritized_zones : data.prioritized_zones ?? [])[0];
  const topRoute = ((effectiveData.optimized_routes?.length ? effectiveData.optimized_routes : effectiveData.routes) ?? [])[0];
  const assignments = (effectiveData.truck_assignments?.length ? effectiveData.truck_assignments : data.truck_assignments) ?? [];
  const plan = (effectiveData.intervention_plan?.length ? effectiveData.intervention_plan : data.intervention_plan) ?? [];
  const recommendation = topZone && topRoute
    ? `Asignar prioridad a ${topZone.name} y despachar ${topRoute.truck} para atender la ruta más urgente.`
    : "Revisar el monitoreo de zonas y rutas para definir la siguiente acción operativa.";
  const actionDetail = topZone && topRoute
    ? `Acción sugerida: ${topRoute.truck} debe dirigirse a ${topZone.name} con intervención inmediata.`
    : "No hay una acción prioritaria definida en este momento.";

  return (
    <div className="two-col">
      <Panel title="Acción prioritaria">
        <div className="list">
          <Item title="Recomendación" detail={recommendation} color="red" />
          <Item title="Plan de intervención" detail={actionDetail} color="yellow" />
          {plan.map((step, index) => <Item key={`${step.title}-${index}`} title={step.title} detail={`${step.detail} · Prioridad ${step.priority}`} color={step.priority === "alta" ? "red" : "neutral"} />)}
          {topZone && <Item title="Zona crítica" detail={`${topZone.name} · Puntaje ${topZone.priority_score} · ${topZone.criticality}`} color="yellow" />}
          {topRoute && <Item title="Ruta priorizada" detail={`${topRoute.truck} · ${topRoute.zone} · ${topRoute.eta} · ${topRoute.delay}`} color="neutral" />}
        </div>
      </Panel>
      <Panel title="Monitoreo operativo">
        <div className="list">
          {alerts.length === 0 ? <p>No hay alertas operativas.</p> : alerts.map((alert, index) => <Item key={`${alert}-${index}`} title="Operación" detail={alert} color="yellow" />)}
        </div>
      </Panel>
      <Panel title="Eventos recientes">
        <div className="list">
          {recentEvents.length === 0 ? <p>No hay eventos operativos recientes.</p> : recentEvents.map(event => <Item key={event.id} title={event.title} detail={event.message} color="neutral" />)}
        </div>
      </Panel>
      <Panel title="Eventos operativos">
        <form className="form-grid" onSubmit={submitEventUpdate}>
          <label htmlFor="ops-event-type">
            Tipo de evento
            <Select
              id="ops-event-type"
              value={eventType}
              onChange={value => setEventType(value as "route_update" | "container_update")}
              options={[
                { value: "route_update", label: "Actualización de ruta" },
                { value: "container_update", label: "Actualización de contenedor" },
              ]}
            />
          </label>
          <label htmlFor="ops-event-target">
            Objetivo
            <Select
              id="ops-event-target"
              value={String(eventTargetId)}
              onChange={value => setEventTargetId(Number(value))}
              options={eventType === "route_update"
                ? routes.map(route => ({ value: String(route.id), label: `Ruta ${route.truck} - ${route.zone}` }))
                : containers.map(container => ({ value: String(container.id), label: `${container.name} (${container.fill_level}%)` }))}
              placeholder="Selecciona un objetivo"
            />
          </label>
          {eventType === "route_update" ? (
            <>
              <label>
                Progreso
                <input name="progress" type="number" min={0} max={100} placeholder="Ej. 75" />
              </label>
              <label>
                Retraso
                <input name="delay" type="text" placeholder="Retraso leve" />
              </label>
            </>
          ) : (
            <>
              <label>
                Llenado (%)
                <input name="fill_level" type="number" min={0} max={100} placeholder="85" />
              </label>
              <label>
                Estado
                <input name="status" type="text" placeholder="Operativo / Lleno" />
              </label>
            </>
          )}
          <label className="wide">
            Nota operativa
            <textarea name="note" placeholder="Detalle de la acción..." />
          </label>
          <button type="submit" className="btn-primary">Enviar evento</button>
        </form>
      </Panel>
      <Panel title="Asignaciones de despacho">
        <div className="list">
          {assignments.length === 0 ? <p>No hay asignaciones activas.</p> : assignments.map(assignment => <Item key={assignment.route_id} title={`${assignment.truck_code} · ${assignment.zone}`} detail={`${assignment.action} · Prioridad ${assignment.priority} · ETA ${assignment.eta}`} color={assignment.priority === "Alta" ? "red" : "neutral"} />)}
        </div>
      </Panel>
      <Panel title="Prioridad de zonas y rutas">
        <div className="list">
          {(data.prioritized_zones ?? []).map(zone => <Item key={zone.id} title={zone.name} detail={`Prioridad ${zone.priority_score} | ${zone.criticality}`} color={zone.priority_score >= 5 ? "red" : "neutral"} />)}
          {(data.optimized_routes ?? []).map(route => <Item key={route.id} title={`Ruta ${route.truck}`} detail={`${route.zone} | ${route.eta} | ${route.delay}`} color={route.delay.includes("Retraso") ? "yellow" : "green"} />)}
          {(data.truck_assignments ?? []).map(assignment => <Item key={assignment.route_id} title={`Asignación ${assignment.truck_code}`} detail={`${assignment.zone} · ${assignment.priority} · ETA ${assignment.eta}`} color={assignment.priority === "Alta" ? "red" : "neutral"} />)}
        </div>
      </Panel>
      <Panel title="Contenedores y mantenimiento">
        <div className="list">
          {(data.containers ?? []).map(container => <Item key={container.id} title={container.name} detail={`${container.fill_level}% | ${container.status}`} color={container.fill_level >= 80 ? "red" : "green"} />)}
          {(data.maintenance ?? []).map(item => <Item key={item.id} title={`Mantenimiento #${item.id}`} detail={`${item.description} | ${item.status}`} color={item.status === "Pendiente" ? "yellow" : "green"} />)}
        </div>
      </Panel>
    </div>
  );
}

export default Operations;
