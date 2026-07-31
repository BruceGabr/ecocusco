import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Zone } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { AdminListRow } from "./AdminListRow";

export function ZonePanel({ zones: initialZones }: { zones: Zone[] }) {
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [zoneSearch, setZoneSearch] = useState("");
  const [newZoneName, setNewZoneName] = useState("");
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
  const [editingZoneName, setEditingZoneName] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setZones(initialZones ?? []);
  }, [initialZones]);

  const filteredZones = useMemo(
    () => zones.filter(zone => zone.name.toLowerCase().includes(zoneSearch.toLowerCase().trim())),
    [zones, zoneSearch]
  );

  async function createZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      const created = await request<Zone>('/zones', {
        method: 'POST',
        body: JSON.stringify({ name: newZoneName, latitude: 0, longitude: 0, criticality: 'Media' })
      });
      setZones(prev => [...prev, created]);
      setNewZoneName('');
      setFeedback(`Zona creada: ${created.name}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la zona');
    }
  }

  function startEditZone(zone: Zone) {
    setEditingZoneId(zone.id);
    setEditingZoneName(zone.name);
  }

  async function saveZoneEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingZoneId === null) return;
    try {
      const updated = await request<Zone>(`/zones/${editingZoneId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingZoneName })
      });
      setZones(prev => prev.map(zone => zone.id === editingZoneId ? { ...zone, name: updated.name } : zone));
      setEditingZoneId(null);
      setEditingZoneName("");
      setFeedback(`Zona actualizada: ${updated.name}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo editar la zona');
    }
  }

  async function deleteZone(zoneId: number) {
    try {
      await request(`/zones/${zoneId}`, { method: 'DELETE' });
      setZones(prev => prev.filter(zone => zone.id !== zoneId));
      setFeedback('Zona eliminada');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar la zona');
    }
  }

  return (
    <Panel title="Gestión de zonas">
      <p>Administra las zonas de recolección y priorización urbana.</p>
      {editingZoneId === null ? (
        <form className="form-grid" onSubmit={createZone}>
          <label htmlFor="new-zone-name">Nombre de la zona<input id="new-zone-name" required placeholder="Nombre de zona" value={newZoneName} onChange={event => setNewZoneName(event.currentTarget.value)} /></label>
          <button type="submit">Crear zona</button>
        </form>
      ) : (
        <form className="form-grid" onSubmit={saveZoneEdit}>
          <label htmlFor="edit-zone-name">Nombre de la zona<input id="edit-zone-name" required value={editingZoneName} onChange={event => setEditingZoneName(event.currentTarget.value)} /></label>
          <button type="submit">Guardar cambios</button>
          <Button onClick={() => { setEditingZoneId(null); setEditingZoneName(""); }}>Cancelar</Button>
        </form>
      )}
      {feedback && <p className="hint success" aria-live="polite">{feedback}</p>}
      <div className="search-box">
        <Icon name="search" size={18} />
        <input type="text" placeholder="Filtrar zonas" value={zoneSearch} onChange={event => setZoneSearch(event.currentTarget.value)} aria-label="Filtrar zonas" />
      </div>
      <ul className="list" aria-label="Lista de zonas">
        {filteredZones.map(zone => (
          <AdminListRow key={zone.id}>
            <div>
              <strong>{zone.name}</strong>
              <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>Criticidad {zone.criticality}</div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Button size="sm" onClick={() => startEditZone(zone)}>
                <Icon name="edit" size={16} />
                Editar zona
              </Button>
              <Button size="sm" variant="danger" onClick={() => deleteZone(zone.id)}>
                <Icon name="trash" size={16} />
                Eliminar zona
              </Button>
            </div>
          </AdminListRow>
        ))}
      </ul>
    </Panel>
  );
}

export default ZonePanel;
