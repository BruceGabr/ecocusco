import React, { FormEvent, useState } from "react";
import { Credentials, Role, Session, Zone } from "../types";
import { request } from "../api";
import { Icon } from "../components/Icon";
import { Select } from "../components/Select";
import { collectErrors, errorProps, FieldErrors } from "../utils/validation";

export function AuthView({ zones, onLogin, message }: { zones: Zone[]; onLogin: (credentials: Credentials) => Promise<void>; message: string }) {
  // Las zonas salen siempre de `GET /api/zones`. Antes había una lista de
  // respaldo escrita a mano: si el catálogo cambiaba o el backend no
  // respondía, el formulario ofrecía zonas que podían no existir y el registro
  // quedaba asociado a una zona inventada.
  const zoneOptions = zones.map(zone => ({ value: zone.name, label: zone.name }));
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  // Errores de registro/recuperación. Los de login NO se guardan aquí: el
  // fallo de onLogin sube al contenedor y vuelve por la prop `message`, así que
  // duplicarlo mostraba el mismo texto dos veces (en verde y en rojo).
  const [localError, setLocalError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  // La zona no viaja en el FormData: el Select propio no es un control nativo,
  // así que su valor vive en el estado del componente.
  const [zone, setZone] = useState("");
  // La contraseña se escribe a ciegas y hay un mínimo de 8 caracteres: poder
  // verla evita el ciclo de fallar el acceso por una errata.
  const [showPassword, setShowPassword] = useState(false);

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
        // La confirmación se comprueba aquí y no en el backend: es un error de
        // tecleo del formulario, no una regla del dominio.
        const confirmation = String(form.get("password-confirm") || "");
        if (password !== confirmation) {
          setErrors({ "password-confirm": "Las contraseñas no coinciden" });
          return;
        }
        if (!zone) {
          setLocalError("Selecciona la zona en la que vives.");
          return;
        }
        // El rol no se envía: el registro público siempre crea un ciudadano y
        // el backend ignora lo que llegue en este campo.
        const created = await request<{ token?: string; user?: Session }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, zone }) });
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
      // La contraseña se pasa como argumento. Antes viajaba por
      // `window.__password`, una variable global legible por cualquier script
      // cargado en la página.
      await onLogin({ email, password });
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
                <div className="input-with-action">
                  <input id="password" name="password" type={showPassword ? "text" : "password"} required minLength={8} placeholder="Mínimo 8 caracteres" {...errorProps("password", errors)} />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => setShowPassword(value => !value)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                  </button>
                </div>
                {errors.password && <span className="field-error" id="password-error">{errors.password}</span>}
              </div>
            )}
            {mode === "register" && (
              <div className="form-group">
                <label htmlFor="password-confirm">Confirmar contraseña</label>
                <input id="password-confirm" name="password-confirm" type={showPassword ? "text" : "password"} required minLength={8} placeholder="Repite la contraseña" {...errorProps("password-confirm", errors)} />
                {errors["password-confirm"] && <span className="field-error" id="password-confirm-error">{errors["password-confirm"]}</span>}
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
            {/* Solo en registro. El selector de Rol se retiró: el alta pública
                siempre crea un ciudadano, así que ofrecer "Administrador" era
                a la vez engañoso y una escalada de privilegios. Las cuentas de
                operador, conductor y administrador las crea un administrador
                desde el panel. */}
            {mode === "register" && (
              <div className="form-group">
                <label htmlFor="zone">Zona</label>
                <Select id="zone" value={zone} onChange={setZone} options={zoneOptions} placeholder="Selecciona tu zona" />
                {zoneOptions.length === 0 && (
                  <span className="field-error">No se pudo cargar el catálogo de zonas. Inténtalo de nuevo en unos segundos.</span>
                )}
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
