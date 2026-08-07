import React, { useEffect, useMemo, useState } from "react";
import { request } from "../../api";
import { Panel } from "../Panel";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Modal } from "../Modal";
import { DataTable, Column } from "../DataTable";
import { Toolbar, FilterSelect } from "../Toolbar";
import { Pagination, paginate } from "../Pagination";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";
import { MapView } from "../MapView";
import { RouteSession, TrackPoint, Zone } from "../../types";
import { exportToCSV } from "../../utils/export";

const PAGE_SIZE = 8;

/** Cada cuánto se refresca la lista mientras hay rutas en curso. */
const REFRESH_MS = 15_000;

/**
 * Monitoreo de conductores.
 *
 * Cada fila es una salida real: quién condujo, con qué camión, desde cuándo y
 * cuánto lleva recorrido, con los puntos que su móvil fue emitiendo. Es lo que
 * permite responder "¿pasó el camión por esa calle?" con un dato y no con una
 * suposición.
 */
export function TrackingPanel({ zones = [] }: { zones?: Zone[] }) {
  const [sessions, setSessions] = useState<RouteSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");

  const [detail, setDetail] = useState<{ session: RouteSession; points: TrackPoint[] } | null>(null);
  const [loadingTrack, setLoadingTrack] = useState(false);

  async function load() {
    try {
      setSessions(await request<RouteSession[]>("/tracking/sessions"));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el seguimiento");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const driverOptions = useMemo(
    () =>
      [...new Set(sessions.map(item => item.driver).filter(Boolean))].map(driver => ({
        value: String(driver),
        label: String(driver),
      })),
    [sessions]
  );

  const filtered = useMemo(
    () =>
      sessions.filter(item => {
        const matchesStatus = !statusFilter || item.status === statusFilter;
        const matchesDriver = !driverFilter || item.driver === driverFilter;
        return matchesStatus && matchesDriver;
      }),
    [sessions, statusFilter, driverFilter]
  );

  useEffect(() => { setPage(1); }, [statusFilter, driverFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = paginate(filtered, currentPage, PAGE_SIZE);

  const active = sessions.filter(item => item.status === "activa");

  async function openTrack(session: RouteSession) {
    setLoadingTrack(true);
    try {
      setDetail(await request<{ session: RouteSession; points: TrackPoint[] }>(`/tracking/sessions/${session.id}/track`));
    } catch (trackError) {
      setError(trackError instanceof Error ? trackError.message : "No se pudo cargar el recorrido");
    } finally {
      setLoadingTrack(false);
    }
  }

  const columns: Column<RouteSession>[] = [
    {
      key: "driver",
      header: "Conductor",
      render: session => (
        <>
          <strong>{session.driver ?? "—"}</strong>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{session.truck ?? "Sin camión"}</div>
        </>
      ),
    },
    { key: "zone", header: "Zona", render: session => session.zone ?? "—" },
    { key: "start", header: "Inicio", render: session => formatDateTime(session.started_at) },
    {
      key: "duration",
      header: "Duración",
      render: session => formatDuration(session.started_at, session.finished_at),
    },
    { key: "distance", header: "Recorrido", render: session => formatDistance(session.distance_m) },
    { key: "points", header: "Puntos", align: "right", render: session => session.positions_count },
    { key: "status", header: "Estado", render: session => <StatusBadge status={session.status} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: session => (
        <div className="table-actions">
          <Button size="sm" onClick={() => openTrack(session)} disabled={loadingTrack}>
            <Icon name="map" size={15} /> Ver recorrido
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Panel
      title="Seguimiento de conductores"
      actions={
        <button
          type="button"
          className="action-btn"
          onClick={() =>
            exportToCSV(
              "seguimiento",
              filtered.map(session => ({
                conductor: session.driver,
                camion: session.truck,
                zona: session.zone,
                inicio: session.started_at,
                fin: session.finished_at ?? "",
                recorrido_m: session.distance_m,
                puntos: session.positions_count,
                estado: session.status,
              }))
            )
          }
        >
          <Icon name="download" /> CSV
        </button>
      }
    >
      {error && <p className="hint error" role="alert">{error}</p>}

      {active.length > 0 && (
        <>
          <p className="hint success" aria-live="polite">
            {active.length === 1
              ? "1 camión circulando ahora mismo."
              : `${active.length} camiones circulando ahora mismo.`}
          </p>
          <MapView
            zones={zones}
            trucks={active
              .filter(session => session.last_position)
              .map(session => ({
                id: session.id,
                code: session.truck ?? "Camión",
                driver: session.driver ?? "",
                status: "En ruta",
                zone: session.zone ?? "",
                latitude: session.last_position!.latitude,
                longitude: session.last_position!.longitude,
              }))}
            routes={[]}
            prioritizedZones={[]}
          />
        </>
      )}

      <Toolbar
        filters={
          <>
            <FilterSelect
              label="Estado"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "activa", label: "En curso" },
                { value: "finalizada", label: "Finalizada" },
              ]}
              allLabel="Todos"
            />
            <FilterSelect
              label="Conductor"
              value={driverFilter}
              onChange={setDriverFilter}
              options={driverOptions}
              allLabel="Todos"
            />
          </>
        }
      />

      {loading ? (
        <EmptyState message="Cargando el seguimiento..." />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={session => session.id}
            caption="Sesiones de ruta registradas desde la app móvil"
            emptyMessage="Todavía no hay rutas registradas desde la app del conductor."
          />
          <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} onChange={setPage} />
        </>
      )}

      <Modal
        open={detail !== null}
        title={detail ? `Recorrido de ${detail.session.driver ?? "conductor"}` : ""}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <dl className="detail-list">
              <dt>Camión</dt>
              <dd>{detail.session.truck ?? "—"}</dd>
              <dt>Inicio</dt>
              <dd>{formatDateTime(detail.session.started_at)}</dd>
              <dt>Fin</dt>
              <dd>{detail.session.finished_at ? formatDateTime(detail.session.finished_at) : "En curso"}</dd>
              <dt>Duración</dt>
              <dd>{formatDuration(detail.session.started_at, detail.session.finished_at)}</dd>
              <dt>Recorrido</dt>
              <dd>{formatDistance(detail.session.distance_m)}</dd>
              <dt>Puntos emitidos</dt>
              <dd>{detail.session.positions_count}</dd>
            </dl>
            {detail.points.length === 0 ? (
              <EmptyState message="Esta ruta todavía no tiene puntos emitidos." />
            ) : (
              <MapView
                zones={zones}
                trucks={[]}
                routes={[]}
                prioritizedZones={[]}
                track={detail.points}
              />
            )}
          </>
        )}
      </Modal>
    </Panel>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(from: string, to: string | null): string {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "—";
  const minutes = Math.round((end - start) / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export default TrackingPanel;
