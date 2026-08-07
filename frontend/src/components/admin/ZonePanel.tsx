import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Zone } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { DataTable, Column } from "../DataTable";
import { Toolbar, FilterSelect } from "../Toolbar";
import { Pagination, paginate } from "../Pagination";
import { Select } from "../Select";
import { StatusBadge } from "../StatusBadge";
import { BulkActionBar } from "../BulkActionBar";
import { useBulkActions } from "../../hooks/useBulkActions";
import { CRITICALITY_LEVELS, toOptions } from "../../constants";
import { collectErrors, errorProps, FieldErrors } from "../../utils/validation";

const PAGE_SIZE = 8;

type ZoneForm = { name: string; criticality: string; latitude: number; longitude: number };
const EMPTY_FORM: ZoneForm = { name: "", criticality: "Media", latitude: 0, longitude: 0 };

export function ZonePanel({ zones: initialZones }: { zones: Zone[] }) {
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [page, setPage] = useState(1);

  const [zoneFilter, setZoneFilter] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM);

  useEffect(() => {
    setZones(initialZones ?? []);
  }, [initialZones]);

  const filtered = useMemo(() => zones.filter(zone => {
    const matchesZone = !zoneFilter || zone.name === zoneFilter;
    const matchesCriticality = !criticalityFilter || zone.criticality === criticalityFilter;
    return matchesZone && matchesCriticality;
  }), [zones, zoneFilter, criticalityFilter]);

  useEffect(() => { setPage(1); }, [zoneFilter, criticalityFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  // La selección abarca solo la página visible: es lo que el usuario ve marcado.
  const bulk = useBulkActions({ resource: "zones", availableIds: visible.map(zone => zone.id) });

  function report(message: string, error = false) {
    setFeedback(message);
    setIsError(error);
  }

  async function deleteSelected() {
    try {
      const result = await bulk.deleteSelected();
      setZones(prev => prev.filter(zone => !result.deleted.includes(zone.id)));
      report(result.failed.length
        ? `${result.count} zona(s) eliminada(s); ${result.failed.length} no se pudo(ieron) eliminar`
        : `${result.count} zona(s) eliminada(s)`, result.failed.length > 0);
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudieron eliminar las zonas', true);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(zone: Zone) {
    setEditingId(zone.id);
    setForm({ name: zone.name, criticality: zone.criticality, latitude: zone.latitude, longitude: zone.longitude });
    setErrors({});
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = collectErrors(event.currentTarget);
    if (Object.keys(found).length > 0) { setErrors(found); return; }
    setErrors({});
    try {
      if (editingId === null) {
        const created = await request<Zone>('/zones', { method: 'POST', body: JSON.stringify(form) });
        setZones(prev => [...prev, created]);
        report(`Zona creada: ${created.name}`);
      } else {
        const updated = await request<Zone>(`/zones/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) });
        setZones(prev => prev.map(zone => zone.id === editingId ? { ...zone, ...updated } : zone));
        report(`Zona actualizada: ${updated.name}`);
      }
      setModalOpen(false);
      setEditingId(null);
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo guardar la zona', true);
    }
  }

  async function deleteZone(zone: Zone) {
    try {
      await request(`/zones/${zone.id}`, { method: 'DELETE' });
      setZones(prev => prev.filter(item => item.id !== zone.id));
      if (zoneFilter === zone.name) setZoneFilter("");
      report('Zona eliminada');
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo eliminar la zona', true);
    }
  }

  const columns: Column<Zone>[] = [
    { key: "name", header: "Zona", render: zone => <strong>{zone.name}</strong> },
    { key: "criticality", header: "Criticidad", render: zone => <StatusBadge status={zone.criticality} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: zone => (
        <div className="table-actions">
          <Button size="sm" onClick={() => openEdit(zone)}><Icon name="edit" size={15} /> Editar zona</Button>
          <Button size="sm" variant="danger" onClick={() => deleteZone(zone)}><Icon name="trash" size={15} /> Eliminar zona</Button>
        </div>
      ),
    },
  ];

  return (
    <Panel title="Gestión de zonas">
      <Toolbar
        filters={
          <>
            <FilterSelect label="Zona" value={zoneFilter} onChange={setZoneFilter} options={zones.map(zone => ({ value: zone.name, label: zone.name }))} allLabel="Todas" />
            <FilterSelect label="Criticidad" value={criticalityFilter} onChange={setCriticalityFilter} options={toOptions(CRITICALITY_LEVELS)} allLabel="Todas" />
          </>
        }
        action={<button type="button" className="btn primary" onClick={openCreate}>Crear zona</button>}
      />

      {feedback && <p className={`hint ${isError ? "error" : "success"}`} aria-live="polite">{feedback}</p>}

      <BulkActionBar count={bulk.count} noun={{ singular: "zona", plural: "zonas" }} busy={bulk.busy} onClear={bulk.clear} onDelete={deleteSelected} />

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={zone => zone.id}
        caption="Lista de zonas"
        emptyMessage="No hay zonas que coincidan con el filtro"
        selection={{
          isSelected: zone => bulk.isSelected(zone.id),
          onToggle: zone => bulk.toggle(zone.id),
          allSelected: bulk.allSelected,
          onToggleAll: bulk.toggleAll,
          labelOf: zone => `Seleccionar zona ${zone.name}`,
        }}
      />
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />

      <Modal open={modalOpen} title={editingId === null ? "Nueva zona" : "Editar zona"} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={submitForm} noValidate>
          <label className="wide" htmlFor="zone-name">Nombre de la zona
            <input id="zone-name" required placeholder="Ej. Wanchaq" value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.currentTarget.value }))} {...errorProps("zone-name", errors)} />
            {errors["zone-name"] && <span className="field-error" id="zone-name-error">{errors["zone-name"]}</span>}
          </label>
          <label htmlFor="zone-criticality">Criticidad<Select id="zone-criticality" value={form.criticality} onChange={value => setForm(prev => ({ ...prev, criticality: value }))} options={toOptions(CRITICALITY_LEVELS)} /></label>
          <div className="form-actions">
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <button type="submit" className="btn primary">{editingId === null ? "Crear zona" : "Guardar cambios"}</button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

export default ZonePanel;
