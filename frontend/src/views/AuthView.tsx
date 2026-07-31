import React, { FormEvent, useState } from "react";
import { Role, Session, Zone } from "../types";
import { request } from "../api";
import { Icon } from "../components/Icon";

export function AuthView({ zones, onLogin, message }: { zones: Zone[]; onLogin: (session: Session) => Promise<void>; message: string }) {
  const fallbackZones = zones.length ? zones.map(zone => zone.name) : ["Centro Historico", "Wanchaq", "San Sebastian", "San Jeronimo", "Santiago"];
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password")).trim();
    const token = String(form.get("token") || "").trim();
    const name = String(form.get("name") || "").trim();
    const role = String(form.get("role") || "ciudadano") as Role;
    const zone = String(form.get("zone") || "Centro Historico");
    setIsSubmitting(true);
    setFeedback("");
    try {
      if (mode === "register") {
        const created = await request<{ token?: string; user?: Session }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role, zone }) });
        if (!created.token || !created.user) throw new Error('No se pudo registrar el usuario');
        localStorage.setItem('sir-token', created.token);
        localStorage.setItem('sir-session', JSON.stringify({ ...created.user, email }));
        window.location.reload();
        return;
      }
      if (mode === "forgot") {
        if (!email) throw new Error('Ingresa un correo para recuperar la contraseña');
        if (!token) {
          const response = await request<{ ok?: boolean; token?: string; message?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
          setFeedback(response.message || 'Si el correo existe, se enviará el token de recuperación');
          return;
        }
        const response = await request<{ ok?: boolean; message?: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
        setFeedback(response.message || 'Contraseña actualizada correctamente');
        setMode('login');
        return;
      }
      (window as Window & { __password?: string }).__password = password;
      await onLogin({ name, email, role, zone });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar la acción';
      setFeedback(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-view">
      <section className="auth-brand">
        <h1>Eco<span>Cusco</span></h1>
        <p>Plataforma inteligente de gestión de residuos sólidos para la ciudad del Cusco.</p>
        <div className="brand-features">
          <div><Icon name="recycle" /> Recolección segregada</div>
          <div><Icon name="map" /> Monitoreo en tiempo real</div>
          <div><Icon name="users" /> Participación comunitaria</div>
        </div>
      </section>

      <section className="auth-form">
        <div className="auth-form-inner">
          <div className="auth-tabs">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Iniciar sesión</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Registrarme</button>
            <button type="button" className={mode === "forgot" ? "active" : ""} onClick={() => setMode("forgot")}>Recuperar</button>
          </div>

          <form onSubmit={submit}>
            {mode === "register" && (
              <div className="form-group">
                <label htmlFor="name">Nombre completo</label>
                <input id="name" name="name" required placeholder="Ej. Ana Quispe Huamán" />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" name="email" type="email" required placeholder="tu.email@ejemplo.com" />
            </div>
            {mode !== "forgot" && (
              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input id="password" name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" />
              </div>
            )}
            {mode === "forgot" && (
              <>
                <div className="form-group">
                  <label htmlFor="token">Token de recuperación</label>
                  <input id="token" name="token" placeholder="Pega el token recibido" />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Nueva contraseña</label>
                  <input id="password" name="password" type="password" required minLength={8} placeholder="Ingresa una nueva contraseña" />
                </div>
              </>
            )}
            {mode !== "forgot" && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label htmlFor="role">Rol</label>
                  <select id="role" name="role">
                    <option value="ciudadano">Ciudadano</option>
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                    <option value="conductor">Conductor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="zone">Zona</label>
                  <select id="zone" name="zone">
                    {fallbackZones.map(zone => <option key={zone}>{zone}</option>)}
                  </select>
                </div>
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{marginTop:8}}>
              {isSubmitting ? "Procesando..." : mode === "login" ? "Iniciar sesión" : mode === "forgot" ? "Restablecer contraseña" : "Crear cuenta"}
            </button>
          </form>

          {feedback && <p className="hint success">{feedback}</p>}
          {message && <p className="hint error">{message}</p>}
        </div>
      </section>
    </main>
  );
}

export default AuthView;
