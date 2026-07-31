import React, { FormEvent, useEffect, useState } from "react";
import { Role, Session } from "../../types";
import { request } from "../../api";
import { Panel } from "../Panel";
import { Button } from "../Button";
import { AdminListRow } from "./AdminListRow";

export function UserPanel({ users: initialUsers }: { users: Session[] }) {
  const [users, setUsers] = useState<Session[]>(initialUsers);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<number, Role>>({});
  const [savingUserIds, setSavingUserIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState("");
  const [formValues, setFormValues] = useState({ name: "", email: "", password: "", role: "ciudadano" as Role, zone: "Centro Historico" });

  useEffect(() => {
    setUsers(initialUsers ?? []);
  }, [initialUsers]);

  async function updateUserRole(user: Session) {
    if (!user.id) return;
    const nextRole = userRoleDrafts[user.id] ?? user.role;
    setSavingUserIds(prev => prev.includes(user.id!) ? prev : [...prev, user.id!]);
    try {
      const updated = await request<Session>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole })
      });
      setUsers(prev => prev.map(item => item.id === user.id ? { ...item, role: updated.role ?? nextRole } : item));
      setFeedback(`Rol actualizado para ${user.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el usuario';
      setFeedback(message);
    } finally {
      setSavingUserIds(prev => prev.filter(id => id !== user.id));
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await request<Session>('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: formValues.name,
          email: formValues.email,
          password: formValues.password,
          role: formValues.role,
          zone: formValues.zone,
        })
      });
      if (created) {
        setUsers(prev => [...prev, { ...created, email: formValues.email, role: formValues.role, zone: formValues.zone }]);
      }
      setFeedback(`Usuario creado: ${formValues.name}`);
      setFormValues({ name: "", email: "", password: "", role: "ciudadano", zone: "Centro Historico" });
      (event.currentTarget as HTMLFormElement).reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el usuario';
      setFeedback(message);
    }
  }

  return (
    <Panel title="Gestión de usuarios">
      <p>Administra roles, accesos y usuarios del sistema.</p>
      <form className="form-grid" onSubmit={createUser}>
        <label htmlFor="admin-user-name">Nombre<input id="admin-user-name" required value={formValues.name} onChange={event => setFormValues(prev => ({ ...prev, name: event.currentTarget.value }))} /></label>
        <label htmlFor="admin-user-email">Correo<input id="admin-user-email" required type="email" value={formValues.email} onChange={event => setFormValues(prev => ({ ...prev, email: event.currentTarget.value }))} /></label>
        <label htmlFor="admin-user-password">Contraseña<input id="admin-user-password" required type="password" minLength={8} value={formValues.password} onChange={event => setFormValues(prev => ({ ...prev, password: event.currentTarget.value }))} /></label>
        <label htmlFor="admin-user-role">Rol<select id="admin-user-role" value={formValues.role} onChange={event => setFormValues(prev => ({ ...prev, role: event.currentTarget.value as Role }))}>
          <option value="ciudadano">Ciudadano</option>
          <option value="operador">Operador</option>
          <option value="admin">Administrador</option>
          <option value="conductor">Conductor</option>
        </select></label>
        <label htmlFor="admin-user-zone">Zona<input id="admin-user-zone" value={formValues.zone} onChange={event => setFormValues(prev => ({ ...prev, zone: event.currentTarget.value }))} /></label>
        <button type="submit">Crear usuario</button>
      </form>
      {feedback && <p className="hint success" aria-live="polite">{feedback}</p>}
      <ul className="list" aria-label="Lista de usuarios">
        {users.map((user, index) => (
          <AdminListRow key={`user-${user.id ?? user.email}-${index}`}>
            <div>
              <strong>{user.name}</strong>
              <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>{user.email} · {user.zone}</div>
            </div>
            <select className="inline-select" value={userRoleDrafts[user.id ?? 0] ?? user.role} onChange={event => setUserRoleDrafts(prev => ({ ...prev, [user.id ?? 0]: event.currentTarget.value as Role }))} aria-label={`Rol de ${user.name}`}>
              <option value="ciudadano">Ciudadano</option>
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
              <option value="conductor">Conductor</option>
            </select>
            <Button size="sm" onClick={() => updateUserRole(user)} disabled={!user.id || savingUserIds.includes(user.id)}>{savingUserIds.includes(user.id ?? -1) ? "Guardando..." : "Guardar rol"}</Button>
          </AdminListRow>
        ))}
      </ul>
    </Panel>
  );
}

export default UserPanel;
