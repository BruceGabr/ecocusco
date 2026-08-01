import React, { FormEvent, useState } from "react";
import { Role, Session, Zone } from "../types";
import { request } from "../api";
import { Icon } from "../components/Icon";
import { Select } from "../components/Select";
import { collectErrors, errorProps, FieldErrors } from "../utils/validation";

const ROLE_OPTIONS = [
  { value: "ciudadano", label: "Ciudadano" },
  { value: "operador", label: "Operador" },
  { value: "admin", label: "Administrador" },
  { value: "conductor", label: "Conductor" },
];

export function AuthView({ zones, onLogin, message }: { zones: Zone[]; onLogin: (session: Session) => Promise<void>; message: string }) {
  const fallbackZones = zones.length ? zones.map(zone => zone.name) : ["Centro Historico", "Wanchaq", "San Sebastian", "San Jeronimo", "Santiago"];
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  // Errores de registro/recuperación. Los de login NO se guardan aquí: el
  // fallo de onLogin sube al contenedor y vuelve por la prop `message`, así que
  // duplicarlo mostraba el mismo texto dos veces (en verde y en rojo).
  const [localError, setLocalError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  // Rol y zona ya no viajan en el FormData: el Select propio no es un control
  // nativo, así que su valor vive en el estado del componente.
  const [role, setRole] = useState<Role>("ciudadano");
  const [zone, setZone] = useState(fallbackZones[0] ?? "Centro Historico");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const found = collectErrors(formElement);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    const form = new FormData(formElement);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password")).trim();
    const token = String(form.get("token") || "").trim();
    const name = String(form.get("name") || "").trim();
    setIsSubmitting(true);
    setFeedback("");
    setLocalError("");
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
      // El fallo de login ya viaja al contenedor y regresa por `message`.
      if (mode !== "login") {
        setLocalError(error instanceof Error ? error.message : 'No se pudo completar la acción');
      }
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
            <button type="button" aria-label="Recuperar contraseña" className={mode === "forgot" ? "active" : ""} onClick={() => setMode("forgot")}>Recuperar</button>
          </div>

          <h2>
            {mode === "login" ? "Bienvenido de vuelta" : mode === "register" ? "Crea tu cuenta" : "Recupera tu acceso"}
          </h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Ingresa para continuar con la gestión de residuos."
              : mode === "register"
                ? "Regístrate para reportar incidencias y seguir tu zona."
                : "Te enviaremos un token para restablecer tu contraseña."}
          </p>

          {/* noValidate: la validación la hacemos nosotros para poder mostrar
              los mensajes con el sistema de diseño en vez de la burbuja nativa. */}
          <form onSubmit={submit} noValidate>
            {mode === "register" && (
              <div className="form-group">
                <label htmlFor="name">Nombre completo</label>
                <input id="name" name="name" required placeholder="Ej. Ana Quispe Huamán" {...errorProps("name", errors)} />
                {errors.name && <span className="field-error" id="name-error">{errors.name}</span>}
              </div>
            )}
            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" name="email" type="email" required placeholder="tu.email@ejemplo.com" {...errorProps("email", errors)} />
              {errors.email && <span className="field-error" id="email-error">{errors.email}</span>}
            </div>
            {mode !== "forgot" && (
              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input id="password" name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" {...errorProps("password", errors)} />
                {errors.password && <span className="field-error" id="password-error">{errors.password}</span>}
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
                  <input id="password" name="password" type="password" required minLength={8} placeholder="Ingresa una nueva contraseña" {...errorProps("password", errors)} />
                  {errors.password && <span className="field-error" id="password-error">{errors.password}</span>}
                </div>
              </>
            )}
            {/* Solo en registro: al iniciar sesión el rol y la zona salen de la
                cuenta, no de lo que se elija aquí. Mostrarlos en el login hacía
                creer que se entraba con el rol seleccionado. */}
            {mode === "register" && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label htmlFor="role">Rol</label>
                  <Select id="role" value={role} onChange={next => setRole(next as Role)} options={ROLE_OPTIONS} />
                </div>
                <div className="form-group">
                  <label htmlFor="zone">Zona</label>
                  <Select id="zone" value={zone} onChange={setZone} options={fallbackZones.map(item => ({ value: item, label: item }))} />
                </div>
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{marginTop:8}}>
              {isSubmitting ? "Procesando..." : mode === "login" ? "Iniciar sesión" : mode === "forgot" ? "Restablecer contraseña" : "Crear cuenta"}
            </button>
          </form>

          {feedback && <p className="hint success">{feedback}</p>}
          {(message || localError) && <p className="hint error" role="alert">{message || localError}</p>}
        </div>
      </section>
    </main>
  );
}

export default AuthView;
