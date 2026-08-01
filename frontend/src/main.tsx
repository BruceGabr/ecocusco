import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import Admin from "./components/Admin";
import { Icon } from "./components/Icon";
import { request } from "./api";
import { Bootstrap, Monitor, OperationUpdatePayload, Report, Session, View } from "./types";
import { emptyBootstrap, getOperationalSignal, viewLabels, views } from "./constants";
import { useMonitor } from "./hooks/useMonitor";
import { ToastStack, useToasts } from "./components/Toast";
import { NotificationsMenu } from "./components/NotificationsMenu";
import { AuthView } from "./views/AuthView";
import { Dashboard } from "./views/Dashboard";
import { Schedules } from "./views/Schedules";
import { Reports } from "./views/Reports";
import { Waste } from "./views/Waste";
import { Routes } from "./views/Routes";
import { Operations } from "./views/Operations";
import { Analytics } from "./views/Analytics";

export function App() {
  const [data, setData] = useState<Bootstrap>(emptyBootstrap);
  const { monitor, setMonitor } = useMonitor();
  const effectiveData = useMemo(() => ({ ...data, ...monitor }) as Bootstrap, [data, monitor]);
  const [session, setSession] = useState<Session | null>(() => JSON.parse(localStorage.getItem("sir-session") || "null"));
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  // El error de autenticación se muestra dentro del formulario de acceso y es
  // independiente de las notificaciones transitorias de la aplicación.
  const [authError, setAuthError] = useState("");
  const { toasts, push: pushToast, dismiss: dismissToast, clear: clearToasts } = useToasts();
  const accessibleViews = session?.role === "admin" ? views : views.filter(item => item !== "admin");

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("eco-dark-mode");
    return saved ? JSON.parse(saved) : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    localStorage.setItem("eco-dark-mode", JSON.stringify(isDarkMode));
    document.documentElement.dataset.theme = isDarkMode ? "dark" : "light";
    document.documentElement.style.colorScheme = isDarkMode ? "dark" : "light";
  }, [isDarkMode]);

  async function loadData() {
    setLoading(true);
    try {
      const bootstrap = await request<Bootstrap>("/bootstrap");
      setData(bootstrap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session && session.role !== "admin" && view === "admin") {
      setView("dashboard");
    }
  }, [session, view]);

  useEffect(() => {
    loadData().catch(() => pushToast("No se pudo conectar con FastAPI. Verifica que el backend esté ejecutándose.", "error"));
  }, []);

  async function login(nextSession: Session) {
    try {
      const payload = await request<{ token?: string; user?: Session; detail?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: nextSession.email, password: String((window as Window & { __password?: string }).__password ?? '') })
      });
      if (!payload.token || !payload.user) {
        throw new Error('No se recibió token válido del backend');
      }
      const session = { ...payload.user, email: nextSession.email };
      localStorage.setItem('sir-session', JSON.stringify(session));
      localStorage.setItem('sir-token', payload.token);
      setSession(session);
      setAuthError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión';
      setAuthError(message);
      throw error;
    }
  }

  function logout() {
    localStorage.removeItem('sir-session');
    localStorage.removeItem('sir-token');
    setSession(null);
    setView('dashboard');
    // Sin esto, los avisos de la sesión anterior sobrevivían al cierre de
    // sesión y reaparecían dentro del formulario de acceso.
    clearToasts();
    setAuthError('');
  }

  async function createReport(report: Omit<Report, "id" | "status">) {
    await request<Report>("/reports", { method: "POST", body: JSON.stringify(report) });
    pushToast("Reporte registrado. El equipo municipal ya puede revisarlo.");
    await loadData();
  }

  async function resolveReport(id: number) {
    try {
      await request<Report>(`/reports/${id}/resolve`, { method: "PATCH" });
      pushToast("Incidencia marcada como resuelta.");
      await loadData();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "No se pudo resolver la incidencia", "error");
    }
  }

  async function updateOperation(payload: OperationUpdatePayload) {
    const monitorPayload = await request<Monitor>("/operations/update", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setMonitor(monitorPayload);
    pushToast("Evento operativo registrado y monitoreo actualizado.");
  }

  async function createCollection(payload: { truck_id: number; zone_id: number; kg: number }) {
    try {
      await request<any>("/collections", { method: "POST", body: JSON.stringify(payload) });
      pushToast("Recolección registrada correctamente.");
      await loadData();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "No se pudo registrar la recolección", "error");
    }
  }

  async function confirmCollection(collectionId: number) {
    try {
      await request<any>(`/collections/${collectionId}/confirm`, { method: "POST" });
      pushToast("Recolección confirmada por ciudadano.");
      await loadData();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "No se pudo confirmar la recolección", "error");
    }
  }

  if (!session) {
    return <AuthView zones={data.zones} onLogin={login} message={authError} />;
  }

  const operationalSignal = getOperationalSignal({ ...data, ...monitor });

  const userInitial = session.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Eco<span>Cusco</span></h1>
          <p>Gestión Ambiental Urbana</p>
        </div>
        <nav className="sidebar-nav">
          {accessibleViews.map(item => (
            <button
              key={item}
              className={view === item ? "active" : ""}
              type="button"
              onClick={() => setView(item)}
            >
              <Icon name={item} />
              <span className="nav-label">{viewLabels[item]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{userInitial}</div>
            <div className="user-info">
              <div className="user-name">{session.name}</div>
              <div className="user-role">{session.role}</div>
            </div>
          </div>
          <button type="button" className="sidebar-btn-logout" onClick={logout}>
            <Icon name="logout" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="app-content">
        <div className="app-header">
          <div className="app-header-inner">
            <div className="app-header-left">
              <h2>{viewLabels[view]}</h2>
            </div>
            <div className="app-header-right">
              {/* El estado operativo vive aquí, dentro del módulo de notificaciones:
                  como insignia junto al título repetía el dato que el dashboard ya
                  muestra en "Alertas Pendientes" y competía con el encabezado. */}
              <NotificationsMenu
                notifications={effectiveData.notifications}
                alerts={monitor.alerts}
                summary={operationalSignal.label}
              />
              <button type="button" className="theme-toggle" onClick={() => setIsDarkMode((value: boolean) => !value)} title={isDarkMode ? "Modo claro" : "Modo oscuro"}>
                {isDarkMode ? <Icon name="sun" /> : <Icon name="moon" />}
              </button>
            </div>
          </div>
        </div>

        <div className="app-main">
          {loading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <h2>Eco<span>Cusco</span></h2>
              <p>Cargando datos del sistema...</p>
            </div>
          ) : (
            <Content
              data={effectiveData}
              monitor={monitor}
              session={session}
              view={view}
              onCreateReport={createReport}
              onResolveReport={resolveReport}
              onOperationUpdate={updateOperation}
              onCreateCollection={createCollection}
              onConfirmCollection={confirmCollection}
            />
          )}
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

function Content(props: { data: Bootstrap; monitor: Monitor; session: Session; view: View; onCreateReport: (report: Omit<Report, "id" | "status">) => Promise<void>; onResolveReport: (id: number) => Promise<void>; onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>; onCreateCollection: (payload: { truck_id: number; zone_id: number; kg: number }) => Promise<void>; onConfirmCollection: (collectionId: number) => Promise<void>; }) {
  const { data, monitor, session, view, onOperationUpdate, onResolveReport, onCreateCollection, onConfirmCollection } = props;
  if (view === "dashboard") return <Dashboard data={data} monitor={monitor} />;
  if (view === "admin") return <Admin data={data} onOperationUpdate={onOperationUpdate} />;
  if (view === "schedules") return <Schedules schedules={data.schedules} />;
  if (view === "reports") return <Reports {...props} />;
  if (view === "waste") return <Waste />;
  if (view === "routes") return <Routes data={data} monitor={monitor} />;
  return <Analytics data={data} session={session} onConfirmCollection={onConfirmCollection} />;
}

const rootElement = typeof document !== "undefined" ? document.getElementById("root") : null;
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
