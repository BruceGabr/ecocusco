import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Bootstrap, Truck } from "../../types";
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
import { MAINTENANCE_STATUSES, toOptions } from "../../constants";
import { collectErrors, errorProps, FieldErrors } from "../../utils/validation";

type MaintenanceRecord = NonNullable<Bootstrap["maintenance"]>[number];

const PAGE_SIZE = 8;

type MaintenanceForm = { truck_id: number; description: string; status: string };
const EMPTY_FORM: MaintenanceForm = { truck_id: 0, description: "", status: MAINTENANCE_STATUSES[0] };

export function MaintenancePanel({ trucks, maintenance: initialMaintenance }: { trucks: Truck[]; maintenance: MaintenanceRecord[] }) {
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>(initialMaintenance);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState("");
  const [truckFilter, setTruckFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MaintenanceForm>(EMPTY_FORM);

  useEffect(() => {
    setMaintenance(initialMaintenance ?? []);
  }, [initialMaintenance]);

  // El registro guarda truck_id; la tabla y los filtros muestran el código.
  const truckCodeById = useMemo(() => {
    const map: Record<number, string> = {};
    (trucks ?? []).forEach(truck => { map[truck.id] = truck.code; });
    return map;
  }, [trucks]);

  const truckOptions = useMemo(() => (trucks ?? []).map(truck => ({ value: String(truck.id), label: truck.code })), [trucks]);

  const filtered = useMemo(() => maintenance.filter(item => {
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesTruck = !truckFilter || String(item.truck_id) === truckFilter;
    return matchesStatus && matchesTruck;
  }), [maintenance, statusFilter, truckFilter]);

  useEffect(() => { setPage(1); }, [statusFilter, truckFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  function report(message: string, error = false) {
    setFeedback(message);
    setIsError(error);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, truck_id: trucks?.[0]?.id ?? 0 });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(item: MaintenanceRecord) {
    setEditingId(item.id);
    setForm({ truck_id: item.truck_id, description: item.description, status: item.status });
    setErrors({});
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = collectErrors(event.currentTarget);
    if (Object.keys(found).length > 0) { setErrors(found); return; }
    setErrors({});
    if (!form.truck_id) { report("Selecciona un camión válido", true); return; }
    try {
      if (editingId === null) {
        const created = await request<MaintenanceRecord>('/maintenance', { method: 'POST', body: JSON.stringify(form) });
        setMaintenance(prev => [...prev, created]);
        report(`Mantenimiento creado para camión ${truckCodeById[created.truck_id] ?? created.truck_id}`);
      } else {
        const updated = await request<MaintenanceRecord>(`/maintenance/${editingId}`, { method: 'PATCH', body: JSON.stringify(form) });
        setMaintenance(prev => prev.map(item => item.id === editingId ? { ...item, ...updated } : item));
        report(`Mantenimiento actualizado para camión ${truckCodeById[updated.truck_id] ?? updated.truck_id}`);
      }
      setModalOpen(false);
      setEditingId(null);
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo guardar el mantenimiento', true);
    }
  }

  async function deleteMaintenance(item: MaintenanceRecord) {
    try {
      await request(`/maintenance/${item.id}`, { method: 'DELETE' });
      setMaintenance(prev => prev.filter(record => record.id !== item.id));
      report('Registro de mantenimiento eliminado');
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo eliminar el mantenimiento', true);
    }
  }

  const columns: Column<MaintenanceRecord>[] = [
    { key: "id", header: "N.º", render: item => <strong>#{item.id}</strong> },
    { key: "truck", header: "Camión", render: item => truckCodeById[item.truck_id] ?? `ID ${item.truck_id}` },
    { key: "description", header: "Descripción", render: item => item.description },
    { key: "status", header: "Estado", render: item => <StatusBadge status={item.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: item => (
        <div className="table-actions">
          <Button size="sm" onClick={() => openEdit(item)}><Icon name="edit" size={15} /> Editar mantenimiento</Button>
          <Button size="sm" variant="danger" onClick={() => deleteMaintenance(item)}><Icon name="trash" size={15} /> Eliminar mantenimiento</Button>
        </div>
      ),
    },
  ];

  return (
    <Panel title="Gestión de mantenimiento">
      <Toolbar
        filters={
          <>
            <FilterSelect label="Estado" value={statusFilter} onChange={setStatusFilter} options={toOptions(MAINTENANCE_STATUSES)} allLabel="Todos" />
            <FilterSelect label="Camión" value={truckFilter} onChange={setTruckFilter} options={truckOptions} allLabel="Todos" />
          </>
        }
        action={<button type="button" className="btn primary" onClick={openCreate}>Crear mantenimiento</button>}
      />

      {feedback && <p className={`hint ${isError ? "error" : "success"}`} aria-live="polite">{feedback}</p>}

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={item => item.id}
        caption="Lista de mantenimiento"
        emptyMessage="No hay registros de mantenimiento para este filtro"
      />
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />

      <Modal open={modalOpen} title={editingId === null ? "Nuevo mantenimiento" : "Editar mantenimiento"} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={submitForm} noValidate>
          <label htmlFor="maintenance-truck">Camión<Select id="maintenance-truck" value={String(form.truck_id)} onChange={value => setForm(prev => ({ ...prev, truck_id: Number(value) }))} options={truckOptions} placeholder="Selecciona un camión" /></label>
          <label htmlFor="maintenance-status">Estado<Select id="maintenance-status" value={form.status} onChange={value => setForm(prev => ({ ...prev, status: value }))} options={toOptions(MAINTENANCE_STATUSES)} /></label>
          <label className="wide" htmlFor="maintenance-description">Descripción
            <textarea id="maintenance-description" required value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.currentTarget.value }))} {...errorProps("maintenance-description", errors)} />
            {errors["maintenance-description"] && <span className="field-error" id="maintenance-description-error">{errors["maintenance-description"]}</span>}
          </label>
          <div className="form-actions">
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <button type="submit" className="btn primary">{editingId === null ? "Crear mantenimiento" : "Guardar cambios"}</button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

export default MaintenancePanel;
