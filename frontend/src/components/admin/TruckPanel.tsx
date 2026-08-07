import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Truck, Zone } from "../../types";
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
import { TRUCK_STATUSES, toOptions } from "../../constants";
import { collectErrors, errorProps, FieldErrors } from "../../utils/validation";

const PAGE_SIZE = 8;

type TruckForm = { code: string; driver: string; status: string; zone_id: number; latitude: number; longitude: number };
const EMPTY_FORM: TruckForm = { code: "", driver: "", status: TRUCK_STATUSES[0], zone_id: 0, latitude: 0, longitude: 0 };

export function TruckPanel({ zones, trucks: initialTrucks }: { zones: Zone[]; trucks: Truck[] }) {
  const [trucks, setTrucks] = useState<Truck[]>(initialTrucks);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TruckForm>(EMPTY_FORM);

  useEffect(() => {
    setTrucks(initialTrucks ?? []);
  }, [initialTrucks]);

  const zoneOptions = useMemo(() => (zones ?? []).map(zone => ({ value: String(zone.id), label: zone.name })), [zones]);
  // Los conductores salen de los datos: es un catálogo cerrado y finito, así que
  // un desplegable es más útil que escribir el nombre a ciegas.
  const driverOptions = useMemo(
    () => toOptions([...new Set(trucks.map(truck => truck.driver).filter(Boolean))] as string[]),
    [trucks]
  );

  const filtered = useMemo(() => trucks.filter(truck => {
    const matchesStatus = !statusFilter || truck.status === statusFilter;
    const matchesZone = !zoneFilter || truck.zone === zoneFilter;
    const matchesDriver = !driverFilter || truck.driver === driverFilter;
    return matchesStatus && matchesZone && matchesDriver;
  }), [trucks, statusFilter, zoneFilter, driverFilter]);

  useEffect(() => { setPage(1); }, [statusFilter, zoneFilter, driverFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  const bulk = useBulkActions({ resource: "trucks", availableIds: visible.map(truck => truck.id) });

  function report(message: string, error = false) {
    setFeedback(message);
    setIsError(error);
  }

  async function deleteSelected() {
    try {
      const result = await bulk.deleteSelected();
      setTrucks(prev => prev.filter(truck => !result.deleted.includes(truck.id)));
      report(result.failed.length
        ? `${result.count} camión(es) eliminado(s); ${result.failed.length} no se pudo(ieron) eliminar`
        : `${result.count} camión(es) eliminado(s)`, result.failed.length > 0);
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudieron eliminar los camiones', true);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, zone_id: zones?.[0]?.id ?? 0 });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(truck: Truck) {
    setEditingId(truck.id);
    setForm({
      code: truck.code,
      driver: truck.driver ?? "",
      status: truck.status,
      zone_id: truck.zone_id ?? (zones ?? []).find(zone => zone.name === truck.zone)?.id ?? 0,
      latitude: truck.latitude,
      longitude: truck.longitude,
    });
    setErrors({});
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = collectErrors(event.currentTarget);
    if (Object.keys(found).length > 0) { setErrors(found); return; }
    setErrors({});
    if (!form.zone_id) { report("Selecciona una zona válida", true); return; }
    try {
      if (editingId === null) {
        // zone_id numérico: enviar el nombre de la zona hacía fallar la
        // creación con 422 porque el modelo del backend no lo acepta.
        const created = await request<Truck>('/trucks', { method: 'POST', body: JSON.stringify(form) });
        setTrucks(prev => [...prev, created]);
        report(`Camión creado: ${created.code}`);
      } else {
        const updated = await request<Truck>(`/trucks/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) });
        setTrucks(prev => prev.map(truck => truck.id === editingId ? { ...truck, ...updated } : truck));
        report(`Camión actualizado: ${updated.code}`);
      }
      setModalOpen(false);
      setEditingId(null);
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo guardar el camión', true);
    }
  }

  async function deleteTruck(truck: Truck) {
    try {
      await request(`/trucks/${truck.id}`, { method: 'DELETE' });
      setTrucks(prev => prev.filter(item => item.id !== truck.id));
      report('Camión eliminado');
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo eliminar el camión', true);
    }
  }

  const columns: Column<Truck>[] = [
    { key: "code", header: "Código", render: truck => <strong>{truck.code}</strong> },
    { key: "driver", header: "Conductor", render: truck => truck.driver ?? "Sin conductor" },
    { key: "zone", header: "Zona", render: truck => truck.zone },
    { key: "status", header: "Estado", render: truck => <StatusBadge status={truck.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: truck => (
        <div className="table-actions">
          <Button size="sm" onClick={() => openEdit(truck)}><Icon name="edit" size={15} /> Editar camión</Button>
          <Button size="sm" variant="danger" onClick={() => deleteTruck(truck)}><Icon name="trash" size={15} /> Eliminar camión</Button>
        </div>
      ),
    },
  ];

  return (
    <Panel title="Gestión de camiones">
      <Toolbar
        filters={
          <>
            <FilterSelect label="Estado" value={statusFilter} onChange={setStatusFilter} options={toOptions(TRUCK_STATUSES)} allLabel="Todos" />
            <FilterSelect label="Zona" value={zoneFilter} onChange={setZoneFilter} options={(zones ?? []).map(zone => ({ value: zone.name, label: zone.name }))} allLabel="Todas" />
            <FilterSelect label="Conductor" value={driverFilter} onChange={setDriverFilter} options={driverOptions} allLabel="Todos" />
          </>
        }
        action={<button type="button" className="btn primary" onClick={openCreate}>Crear camión</button>}
      />

      {feedback && <p className={`hint ${isError ? "error" : "success"}`} aria-live="polite">{feedback}</p>}

      <BulkActionBar count={bulk.count} noun={{ singular: "camión", plural: "camiones" }} busy={bulk.busy} onClear={bulk.clear} onDelete={deleteSelected} />

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(truck, index) => `truck-${truck.id}-${index}`}
        caption="Lista de camiones"
        emptyMessage="No hay camiones que coincidan con el filtro"
        selection={{
          isSelected: truck => bulk.isSelected(truck.id),
          onToggle: truck => bulk.toggle(truck.id),
          allSelected: bulk.allSelected,
          onToggleAll: bulk.toggleAll,
          labelOf: truck => `Seleccionar camión ${truck.code}`,
        }}
      />
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />

      <Modal open={modalOpen} title={editingId === null ? "Nuevo camión" : "Editar camión"} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={submitForm} noValidate>
          <label htmlFor="truck-code">Código
            <input id="truck-code" required value={form.code} onChange={event => setForm(prev => ({ ...prev, code: event.currentTarget.value }))} {...errorProps("truck-code", errors)} />
            {errors["truck-code"] && <span className="field-error" id="truck-code-error">{errors["truck-code"]}</span>}
          </label>
          <label htmlFor="truck-driver">Conductor
            <input id="truck-driver" required value={form.driver} onChange={event => setForm(prev => ({ ...prev, driver: event.currentTarget.value }))} {...errorProps("truck-driver", errors)} />
            {errors["truck-driver"] && <span className="field-error" id="truck-driver-error">{errors["truck-driver"]}</span>}
          </label>
          <label htmlFor="truck-status">Estado<Select id="truck-status" value={form.status} onChange={value => setForm(prev => ({ ...prev, status: value }))} options={toOptions(TRUCK_STATUSES)} /></label>
          <label htmlFor="truck-zone">Zona<Select id="truck-zone" value={String(form.zone_id)} onChange={value => setForm(prev => ({ ...prev, zone_id: Number(value) }))} options={zoneOptions} placeholder="Selecciona una zona" /></label>
          <div className="form-actions">
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <button type="submit" className="btn primary">{editingId === null ? "Crear camión" : "Guardar cambios"}</button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

export default TruckPanel;
