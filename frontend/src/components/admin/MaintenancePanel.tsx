import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Bootstrap, Truck } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";
import Item from "../Item";

type MaintenanceRecord = NonNullable<Bootstrap["maintenance"]>[number];

export function MaintenancePanel({ trucks, maintenance: initialMaintenance }: { trucks: Truck[]; maintenance: MaintenanceRecord[] }) {
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>(initialMaintenance);
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState("Todos");
  const [newMaintenance, setNewMaintenance] = useState({ truck_id: trucks?.[0]?.id ?? 0, description: "", status: "Pendiente" });
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setMaintenance(initialMaintenance ?? []);
    setNewMaintenance(prev => ({ ...prev, truck_id: trucks?.[0]?.id ?? prev.truck_id }));
  }, [initialMaintenance, trucks]);

  const filteredMaintenance = useMemo(
    () => maintenance.filter(item => maintenanceStatusFilter === "Todos" || item.status === maintenanceStatusFilter),
    [maintenance, maintenanceStatusFilter]
  );

  async function createMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMaintenance.description.trim()) return;
    try {
      const created = await request<MaintenanceRecord>('/maintenance', {
        method: 'POST',
        body: JSON.stringify(newMaintenance)
      });
      setMaintenance(prev => [...prev, created]);
      setNewMaintenance({ truck_id: trucks?.[0]?.id ?? 0, description: '', status: 'Pendiente' });
      setFeedback(`Mantenimiento creado para camión ${created.truck_id}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el mantenimiento');
    }
  }

  return (
    <Panel title="Gestión de mantenimiento">
      <p>Registra y consulta los estados de mantenimiento de la flota.</p>
      <div className="filter-bar">
        {['Todos', 'Pendiente', 'Completado'].map(option => (
          <button key={option} type="button" className={`filter-btn ${maintenanceStatusFilter === option ? 'active' : ''}`} onClick={() => setMaintenanceStatusFilter(option)}>{option}</button>
        ))}
      </div>
      <form className="form-grid" onSubmit={createMaintenance}>
        <label htmlFor="maintenance-truck">Camión<select id="maintenance-truck" value={newMaintenance.truck_id} onChange={event => setNewMaintenance(prev => ({ ...prev, truck_id: Number(event.currentTarget.value) }))}>
          {trucks?.map((truck, index) => <option key={`truck-${truck.id}-${index}`} value={truck.id}>{truck.code}</option>)}
        </select></label>
        <label htmlFor="maintenance-description">Descripción<textarea id="maintenance-description" required value={newMaintenance.description} onChange={event => setNewMaintenance(prev => ({ ...prev, description: event.currentTarget.value }))} /></label>
        <label htmlFor="maintenance-status">Estado<select id="maintenance-status" value={newMaintenance.status} onChange={event => setNewMaintenance(prev => ({ ...prev, status: event.currentTarget.value }))}><option>Pendiente</option><option>Completado</option></select></label>
        <button type="submit">Crear mantenimiento</button>
      </form>
      {feedback && <p className="hint success" aria-live="polite">{feedback}</p>}
      <ul className="list" aria-label="Lista de mantenimiento">
        {filteredMaintenance.map(item => <li key={item.id}><Item title={`Mantenimiento #${item.id}`} detail={`${item.description} · ${item.status}`} color={item.status === 'Pendiente' ? 'yellow' : 'blue'} /></li>)}
      </ul>
    </Panel>
  );
}

export default MaintenancePanel;
