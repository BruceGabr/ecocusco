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
  const [message, setMessage] = useState("");
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
    loadData().catch(() => setMessage("No se pudo conectar con FastAPI. Verifica que el backend este ejecutandose."));
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
      setMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo iniciar sesión';
      setMessage(message);
      throw error;
    }
  }

  function logout() {
    localStorage.removeItem('sir-session');
    localStorage.removeItem('sir-token');
    setSession(null);
    setView('dashboard');
  }

  async function createReport(report: Omit<Report, "id" | "status">) {
    await request<Report>("/reports", { method: "POST", body: JSON.stringify(report) });
    setMessage("Reporte registrado. El equipo municipal ya puede revisarlo.");
    await loadData();
  }

  async function resolveReport(id: number) {
    await request<Report>(`/reports/${id}/resolve`, { method: "PATCH" });
    setMessage("Incidencia marcada como resuelta.");
    await loadData();
  }

  async function updateOperation(payload: OperationUpdatePayload) {
    const monitorPayload = await request<Monitor>("/operations/update", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setMonitor(monitorPayload);
    setMessage("Evento operativo registrado y monitoreo actualizado.");
  }

  async function createCollection(payload: { truck_id: number; zone_id: number; kg: number }) {
    await request<any>("/collections", { method: "POST", body: JSON.stringify(payload) });
    setMessage("Recolección registrada correctamente.");
    await loadData();
  }

  async function confirmCollection(collectionId: number) {
    await request<any>(`/collections/${collectionId}/confirm`, { method: "POST" });
    setMessage("Recolección confirmada por ciudadano.");
    await loadData();
  }

  if (!session) {
    return <AuthView zones={data.zones} onLogin={login} message={message} />;
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
              <span className={`signal-badge ${operationalSignal.tone}`}>
                {operationalSignal.tone === "ok" ? <Icon name="check" /> : <Icon name="alert" />}
                {operationalSignal.label}
              </span>
            </div>
            <div className="app-header-right">
              <button type="button" className="theme-toggle" onClick={() => setIsDarkMode((value: boolean) => !value)} title={isDarkMode ? "Modo claro" : "Modo oscuro"}>
                {isDarkMode ? <Icon name="sun" /> : <Icon name="moon" />}
              </button>
            </div>
          </div>
        </div>

        <div className="app-main">
          {message && <div role="alert" className="hint success" style={{marginBottom:16}}>{message}</div>}
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
    </main>
  );
}

function Content(props: { data: Bootstrap; monitor: Monitor; session: Session; view: View; onCreateReport: (report: Omit<Report, "id" | "status">) => Promise<void>; onResolveReport: (id: number) => Promise<void>; onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>; onCreateCollection: (payload: { truck_id: number; zone_id: number; kg: number }) => Promise<void>; onConfirmCollection: (collectionId: number) => Promise<void>; }) {
  const { data, monitor, session, view, onOperationUpdate, onResolveReport, onCreateCollection, onConfirmCollection } = props;
  if (view === "dashboard") return <Dashboard data={data} monitor={monitor} />;
  if (view === "admin") return <Admin data={data} session={session} onResolveReport={onResolveReport} onOperationUpdate={onOperationUpdate} />;
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
