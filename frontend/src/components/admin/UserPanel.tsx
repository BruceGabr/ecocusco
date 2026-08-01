import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, Session, Zone } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { DataTable, Column } from "../DataTable";
import { Toolbar, FilterSelect } from "../Toolbar";
import { Pagination, paginate } from "../Pagination";
import { Select } from "../Select";
import { collectErrors, errorProps, FieldErrors } from "../../utils/validation";

const PAGE_SIZE = 8;
const ROLES: Role[] = ["ciudadano", "operador", "admin", "conductor"];
const ROLE_LABELS: Record<Role, string> = {
  ciudadano: "Ciudadano",
  operador: "Operador",
  admin: "Administrador",
  conductor: "Conductor",
};
const ROLE_OPTIONS = ROLES.map(role => ({ value: role, label: ROLE_LABELS[role] }));

type UserForm = { name: string; email: string; password: string; role: Role; zone: string };
const EMPTY_FORM: UserForm = { name: "", email: "", password: "", role: "ciudadano", zone: "" };

export function UserPanel({ users: initialUsers, zones = [] }: { users: Session[]; zones?: Zone[] }) {
  const [users, setUsers] = useState<Session[]>(initialUsers);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [page, setPage] = useState(1);

  const [roleFilter, setRoleFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  useEffect(() => {
    setUsers(initialUsers ?? []);
  }, [initialUsers]);

  const zoneOptions = useMemo(() => zones.map(zone => ({ value: zone.name, label: zone.name })), [zones]);

  const filtered = useMemo(() => users.filter(user => {
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesZone = !zoneFilter || user.zone === zoneFilter;
    return matchesRole && matchesZone;
  }), [users, roleFilter, zoneFilter]);

  useEffect(() => { setPage(1); }, [roleFilter, zoneFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  function report(message: string, error = false) {
    setFeedback(message);
    setIsError(error);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, zone: zones[0]?.name ?? "" });
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(user: Session) {
    if (!user.id) return;
    setEditingId(user.id);
    // La contraseña no se edita desde aquí: el backend no la expone y
    // reenviarla vacía la sobrescribiría.
    setForm({ name: user.name, email: user.email, password: "", role: user.role, zone: user.zone ?? "" });
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
        const created = await request<Session>('/users', {
          method: 'POST',
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role, zone: form.zone }),
        });
        if (created) setUsers(prev => [...prev, { ...created, email: form.email, role: form.role, zone: form.zone }]);
        report(`Usuario creado: ${form.name}`);
      } else {
        const updated = await request<Session>(`/users/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name, email: form.email, role: form.role, zone: form.zone }),
        });
        setUsers(prev => prev.map(user => user.id === editingId ? { ...user, ...updated, name: form.name, email: form.email, role: form.role, zone: form.zone } : user));
        report(`Usuario actualizado: ${form.name}`);
      }
      setModalOpen(false);
      setEditingId(null);
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo guardar el usuario', true);
    }
  }

  async function deleteUser(user: Session) {
    if (!user.id) return;
    try {
      await request(`/users/${user.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(item => item.id !== user.id));
      report('Usuario eliminado');
    } catch (error) {
      report(error instanceof Error ? error.message : 'No se pudo eliminar el usuario', true);
    }
  }

  const columns: Column<Session>[] = [
    {
      key: "user",
      header: "Usuario",
      render: user => (
        <>
          <strong>{user.name}</strong>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{user.email}</div>
        </>
      ),
    },
    { key: "zone", header: "Zona", render: user => user.zone ?? "—" },
    { key: "role", header: "Rol", render: user => <span className="badge neutral">{ROLE_LABELS[user.role] ?? user.role}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: user => (
        <div className="table-actions">
          <Button size="sm" disabled={!user.id} onClick={() => openEdit(user)}><Icon name="edit" size={15} /> Editar usuario</Button>
          <Button size="sm" variant="danger" disabled={!user.id} onClick={() => deleteUser(user)}><Icon name="trash" size={15} /> Eliminar usuario</Button>
        </div>
      ),
    },
  ];

  return (
    <Panel title="Gestión de usuarios">
      <Toolbar
        filters={
          <>
            <FilterSelect label="Rol" value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} allLabel="Todos" />
            <FilterSelect label="Zona" value={zoneFilter} onChange={setZoneFilter} options={zoneOptions} allLabel="Todas" />
          </>
        }
        action={<button type="button" className="btn primary" onClick={openCreate}>Crear usuario</button>}
      />

      {feedback && <p className={`hint ${isError ? "error" : "success"}`} aria-live="polite">{feedback}</p>}

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(user, index) => `user-${user.id ?? user.email}-${index}`}
        caption="Lista de usuarios"
        emptyMessage="No hay usuarios que coincidan con el filtro"
      />
      <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />

      <Modal open={modalOpen} title={editingId === null ? "Nuevo usuario" : "Editar usuario"} onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={submitForm} noValidate>
          <label htmlFor="admin-user-name">Nombre
            <input id="admin-user-name" required value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.currentTarget.value }))} {...errorProps("admin-user-name", errors)} />
            {errors["admin-user-name"] && <span className="field-error" id="admin-user-name-error">{errors["admin-user-name"]}</span>}
          </label>
          <label htmlFor="admin-user-email">Correo
            <input id="admin-user-email" required type="email" value={form.email} onChange={event => setForm(prev => ({ ...prev, email: event.currentTarget.value }))} {...errorProps("admin-user-email", errors)} />
            {errors["admin-user-email"] && <span className="field-error" id="admin-user-email-error">{errors["admin-user-email"]}</span>}
          </label>
          {editingId === null && (
            <label htmlFor="admin-user-password">Contraseña
              <input id="admin-user-password" required type="password" minLength={8} value={form.password} onChange={event => setForm(prev => ({ ...prev, password: event.currentTarget.value }))} {...errorProps("admin-user-password", errors)} />
              {errors["admin-user-password"] && <span className="field-error" id="admin-user-password-error">{errors["admin-user-password"]}</span>}
            </label>
          )}
          <label htmlFor="admin-user-role">Rol<Select id="admin-user-role" value={form.role} onChange={value => setForm(prev => ({ ...prev, role: value as Role }))} options={ROLE_OPTIONS} /></label>
          <label htmlFor="admin-user-zone">Zona<Select id="admin-user-zone" value={form.zone} onChange={value => setForm(prev => ({ ...prev, zone: value }))} options={zoneOptions} placeholder="Selecciona una zona" /></label>
          <div className="form-actions">
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <button type="submit" className="btn primary">{editingId === null ? "Crear usuario" : "Guardar cambios"}</button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

export default UserPanel;
