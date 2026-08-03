import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import Admin from './components/Admin';
import { Icon } from './components/Icon';
import { ApiError, request } from './api';
import {
  Bootstrap,
  Credentials,
  Monitor,
  OperationUpdatePayload,
  Report,
  Session,
  View,
  Zone,
} from './types';
import {
  emptyBootstrap,
  getOperationalSignal,
  viewLabels,
  viewsFor,
} from './constants';
import { useMonitor } from './hooks/useMonitor';
import { useSessionRefresh } from './hooks/useSessionRefresh';
import { ToastStack, useToasts } from './components/Toast';
import { NotificationsMenu } from './components/NotificationsMenu';
import { AuthView } from './views/AuthView';
import { Dashboard } from './views/Dashboard';
import { Schedules } from './views/Schedules';
import { Reports } from './views/Reports';
import { Waste } from './views/Waste';
import { Routes } from './views/Routes';
import { Operations } from './views/Operations';
import { Analytics } from './views/Analytics';

export function App() {
  const [data, setData] = useState<Bootstrap>(emptyBootstrap);
  const [session, setSession] = useState<Session | null>(() =>
    JSON.parse(localStorage.getItem('sir-session') || 'null'),
  );
  const { monitor, setMonitor } = useMonitor(Boolean(session), () =>
    expireSession(),
  );
  // Mantiene la sesión viva mientras se use la aplicación: el token dura poco
  // y solo se renueva si hubo actividad real desde la última comprobación.
  useSessionRefresh(Boolean(session), () => expireSession());
  const effectiveData = useMemo(
    () => ({ ...data, ...monitor }) as Bootstrap,
    [data, monitor],
  );
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [expiredSession, setExpiredSession] = useState(false);
  // Catálogo público para el desplegable de zonas del registro: es lo único
  // que la pantalla de acceso necesita, y GET /api/zones es anónimo.
  const [publicZones, setPublicZones] = useState<Zone[]>([]);
  // El error de autenticación se muestra dentro del formulario de acceso y es
  // independiente de las notificaciones transitorias de la aplicación.
  const [authError, setAuthError] = useState('');
  const {
    toasts,
    push: pushToast,
    dismiss: dismissToast,
    clear: clearToasts,
  } = useToasts();
  const accessibleViews = viewsFor(session?.role);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('eco-dark-mode');
    return saved
      ? JSON.parse(saved)
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('eco-dark-mode', JSON.stringify(isDarkMode));
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  /**
   * Devuelve al formulario de acceso porque el backend rechazó el token.
   *
   * Sin esto la aplicación se quedaba atascada: la sesión seguía en
   * localStorage, el monitoreo reintentaba cada 10 segundos y la consola se
   * llenaba de 401 indefinidamente. Pasa al caducar el token (dura 12 h) y
   * también al cambiar de backend, porque cada uno firma con su propia clave.
   */
  function expireSession() {
    clearSession();
    setExpiredSession(true);
  }

  /** Trata el error si era de sesión. Devuelve true cuando lo gestionó. */
  function handleSessionExpired(error: unknown): boolean {
    if (!(error instanceof ApiError) || !error.isUnauthorized) return false;
    expireSession();
    return true;
  }

  function clearSession() {
    localStorage.removeItem('sir-session');
    localStorage.removeItem('sir-token');
    setSession(null);
    setData(emptyBootstrap);
    setMonitor({});
    setView('dashboard');
    clearToasts();
  }

  async function loadData() {
    setLoading(true);
    try {
      const bootstrap = await request<Bootstrap>('/bootstrap');
      setData(bootstrap);
    } finally {
      setLoading(false);
    }
  }

  // Si la sesión no alcanza para la vista activa (p. ej. tras cambiar de
  // usuario), se vuelve al panel principal.
  useEffect(() => {
    if (session && !viewsFor(session.role).includes(view)) {
      setView('dashboard');
    }
  }, [session, view]);

  useEffect(() => {
    if (session) return;
    request<Zone[]>('/zones')
      .then(setPublicZones)
      .catch(() => setPublicZones([]));
  }, [session]);

  // La carga inicial exige sesión: /bootstrap devuelve reportes, notificaciones
  // y usuarios, y ahora está autenticado. Sin sesión no hay nada que pedir.
  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    loadData().catch((error) => {
      if (handleSessionExpired(error)) return;
      pushToast(
        'No se pudo conectar con el backend. Verifica que esté disponible.',
        'error',
      );
    });
  }, [session?.email]);

  async function login(credentials: Credentials) {
    try {
      const payload = await request<{
        token?: string;
        user?: Session;
        detail?: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (!payload.token || !payload.user) {
        throw new Error('No se recibió token válido del backend');
      }
      const session = { ...payload.user, email: credentials.email };
      localStorage.setItem('sir-session', JSON.stringify(session));
      localStorage.setItem('sir-token', payload.token);
      setSession(session);
      setAuthError('');
      setExpiredSession(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo iniciar sesión';
      setAuthError(message);
      throw error;
    }
  }

  function logout() {
    // clearSession también vacía los avisos: sin eso, las notificaciones de la
    // sesión anterior sobrevivían y reaparecían dentro del formulario de acceso.
    clearSession();
    setAuthError('');
    setExpiredSession(false);
  }

  async function createReport(report: Omit<Report, 'id' | 'status'>) {
    await request<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
    pushToast('Reporte registrado. El equipo municipal ya puede revisarlo.');
    await loadData();
  }

  async function resolveReport(id: number) {
    try {
      await request<Report>(`/reports/${id}/resolve`, { method: 'PATCH' });
      pushToast('Incidencia marcada como resuelta.');
      await loadData();
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : 'No se pudo resolver la incidencia',
        'error',
      );
    }
  }

  async function updateOperation(payload: OperationUpdatePayload) {
    const monitorPayload = await request<Monitor>('/operations/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setMonitor(monitorPayload);
    pushToast('Evento operativo registrado y monitoreo actualizado.');
  }

  async function createCollection(payload: {
    truck_id: number;
    zone_id: number;
    kg: number;
  }) {
    try {
      await request<any>('/collections', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      pushToast('Recolección registrada correctamente.');
      await loadData();
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : 'No se pudo registrar la recolección',
        'error',
      );
    }
  }

  async function confirmCollection(collectionId: number) {
    try {
      await request<any>(`/collections/${collectionId}/confirm`, {
        method: 'POST',
      });
      pushToast('Recolección confirmada por ciudadano.');
      await loadData();
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : 'No se pudo confirmar la recolección',
        'error',
      );
    }
  }

  if (!session) {
    return (
      <AuthView
        zones={publicZones}
        onLogin={login}
        message={
          authError ||
          (expiredSession
            ? 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.'
            : '')
        }
      />
    );
  }

  const operationalSignal = getOperationalSignal({ ...data, ...monitor });

  const userInitial = session.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <main className='app-shell'>
      <aside className='sidebar'>
        <div className='sidebar-logo'>
          <h1>
            Eco<span>Cusco</span>
          </h1>
          <p>Gestión Ambiental Urbana</p>
        </div>
        <nav className='sidebar-nav'>
          {accessibleViews.map((item) => (
            <button
              key={item}
              className={view === item ? 'active' : ''}
              type='button'
              onClick={() => setView(item)}
            >
              <Icon name={item} />
              <span className='nav-label'>{viewLabels[item]}</span>
            </button>
          ))}
        </nav>
        <div className='sidebar-footer'>
          <div className='sidebar-user'>
            <div className='avatar'>{userInitial}</div>
            <div className='user-info'>
              <div className='user-name'>{session.name}</div>
              <div className='user-role'>{session.role}</div>
            </div>
          </div>
          <button type='button' className='sidebar-btn-logout' onClick={logout}>
            <Icon name='logout' />
            <p>Cerrar sesión</p>
          </button>
        </div>
      </aside>

      <div className='app-content'>
        <div className='app-header'>
          <div className='app-header-inner'>
            <div className='app-header-left'>
              <h2>{viewLabels[view]}</h2>
            </div>
            <div className='app-header-right'>
              {/* El estado operativo vive aquí, dentro del módulo de notificaciones:
                  como insignia junto al título repetía el dato que el dashboard ya
                  muestra en "Alertas Pendientes" y competía con el encabezado. */}
              <button
                type='button'
                className='theme-toggle'
                onClick={() => setIsDarkMode((value: boolean) => !value)}
                title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
              >
                {isDarkMode ? <Icon name='sun' /> : <Icon name='moon' />}
              </button>
              <NotificationsMenu
                notifications={effectiveData.notifications}
                alerts={monitor.alerts}
                summary={operationalSignal.label}
              />
            </div>
          </div>
        </div>

        <div className='app-main'>
          {loading ? (
            <div className='loading-screen'>
              <div className='spinner'></div>
              <h2>
                Eco<span>Cusco</span>
              </h2>
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

function Content(props: {
  data: Bootstrap;
  monitor: Monitor;
  session: Session;
  view: View;
  onCreateReport: (report: Omit<Report, 'id' | 'status'>) => Promise<void>;
  onResolveReport: (id: number) => Promise<void>;
  onOperationUpdate: (payload: OperationUpdatePayload) => Promise<void>;
  onCreateCollection: (payload: {
    truck_id: number;
    zone_id: number;
    kg: number;
  }) => Promise<void>;
  onConfirmCollection: (collectionId: number) => Promise<void>;
}) {
  const {
    data,
    monitor,
    session,
    view,
    onOperationUpdate,
    onResolveReport,
    onCreateCollection,
    onConfirmCollection,
  } = props;
  if (view === 'dashboard') return <Dashboard data={data} monitor={monitor} />;
  if (view === 'admin')
    return <Admin data={data} onOperationUpdate={onOperationUpdate} />;
  if (view === 'schedules') return <Schedules schedules={data.schedules} />;
  if (view === 'reports') return <Reports {...props} />;
  if (view === 'waste') return <Waste />;
  if (view === 'routes') return <Routes data={data} monitor={monitor} />;
  // La vista de Operaciones estaba importada pero nunca se renderizaba: no
  // existía 'operations' en el tipo View, así que era código inalcanzable.
  if (view === 'operations')
    return (
      <Operations
        data={data}
        monitor={monitor}
        onOperationUpdate={onOperationUpdate}
      />
    );
  return (
    <Analytics
      data={data}
      session={session}
      onConfirmCollection={onConfirmCollection}
    />
  );
}

const rootElement =
  typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
