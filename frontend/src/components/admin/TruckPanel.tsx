import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Truck, Zone } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";
import { Icon } from "../Icon";
import Item from "../Item";

export function TruckPanel({ zones, trucks: initialTrucks }: { zones: Zone[]; trucks: Truck[] }) {
  const [trucks, setTrucks] = useState<Truck[]>(initialTrucks);
  const [truckDriverSearch, setTruckDriverSearch] = useState("");
  const [truckStatusFilter, setTruckStatusFilter] = useState("Todos");
  const [newTruck, setNewTruck] = useState({ code: "", driver: "", status: "En ruta", zone: zones?.[0]?.name ?? "Centro Historico", latitude: 0, longitude: 0 });
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setTrucks(initialTrucks ?? []);
    setNewTruck(prev => ({ ...prev, zone: zones?.[0]?.name ?? prev.zone }));
  }, [initialTrucks, zones]);

  const filteredTrucks = useMemo(
    () => trucks.filter(truck => {
      const driver = truck.driver ?? "";
      const matchesDriver = driver.toLowerCase().includes(truckDriverSearch.toLowerCase().trim());
      const matchesStatus = truckStatusFilter === "Todos" || truck.status === truckStatusFilter;
      return matchesDriver && matchesStatus;
    }),
    [trucks, truckDriverSearch, truckStatusFilter]
  );

  async function createTruck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await request<Truck>('/trucks', {
        method: 'POST',
        body: JSON.stringify(newTruck)
      });
      setTrucks(prev => [...prev, created]);
      setNewTruck({ code: '', driver: '', status: 'En ruta', zone: zones?.[0]?.name ?? 'Centro Historico', latitude: 0, longitude: 0 });
      setFeedback(`Camión creado: ${created.code}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear el camión');
    }
  }

  return (
    <Panel title="Gestión de camiones">
      <p>Filtra y administra el estado de los vehículos de recolección.</p>
      <div className="search-box">
        <Icon name="search" size={18} />
        <input type="text" placeholder="Buscar por conductor" value={truckDriverSearch} onChange={event => setTruckDriverSearch(event.currentTarget.value)} aria-label="Buscar por conductor" />
      </div>
      <div className="filter-bar">
        {['Todos', 'En ruta', 'Mantenimiento'].map(option => (
          <button key={option} type="button" className={`filter-btn ${truckStatusFilter === option ? 'active' : ''}`} onClick={() => setTruckStatusFilter(option)}>{option}</button>
        ))}
      </div>
      <form className="form-grid" onSubmit={createTruck}>
        <label htmlFor="truck-code">Código<input id="truck-code" required value={newTruck.code} onChange={event => setNewTruck(prev => ({ ...prev, code: event.currentTarget.value }))} /></label>
        <label htmlFor="truck-driver">Conductor<input id="truck-driver" required value={newTruck.driver} onChange={event => setNewTruck(prev => ({ ...prev, driver: event.currentTarget.value }))} /></label>
        <label htmlFor="truck-status">Estado<select id="truck-status" value={newTruck.status} onChange={event => setNewTruck(prev => ({ ...prev, status: event.currentTarget.value }))}><option>En ruta</option><option>Mantenimiento</option><option>Disponible</option></select></label>
        <label htmlFor="truck-zone">Zona<select id="truck-zone" value={newTruck.zone} onChange={event => setNewTruck(prev => ({ ...prev, zone: event.currentTarget.value }))}>{zones?.map((zone, index) => <option key={`zone-${zone.id}-${index}`} value={zone.name}>{zone.name}</option>)}</select></label>
        <button type="submit">Crear camión</button>
      </form>
      {feedback && <p className="hint success" aria-live="polite">{feedback}</p>}
      <ul className="list" aria-label="Lista de camiones">
        {filteredTrucks.map((truck, index) => <li key={`truck-${truck.id}-${index}`}><Item title={`${truck.code} · ${truck.driver ?? 'Sin conductor'}`} detail={`${truck.zone} · ${truck.status}`} color={truck.status === 'Mantenimiento' ? 'yellow' : 'blue'} /></li>)}
      </ul>
    </Panel>
  );
}

export default TruckPanel;
