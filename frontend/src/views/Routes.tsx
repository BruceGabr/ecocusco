import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Bootstrap, Monitor, Session } from "../types";
import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import { MapView } from "../components/MapView";
import { EmptyState } from "../components/EmptyState";
import { ProximityPanel } from "../components/ProximityPanel";
import { Select } from "../components/Select";
import Item from "../components/Item";
import { geoBase } from "../constants";

/** Cada cuánto se vuelven a pedir las alertas del microservicio, en ms. */
const GEO_REFRESH_MS = 30_000;

export function Routes({
  data,
  monitor,
  session,
  onCreateCollection,
}: {
  data: Bootstrap;
  monitor: Monitor;
  session: Session;
  onCreateCollection?: (payload: { truck_id: number; zone_id: number; kg: number }) => Promise<void>;
}) {
  const [alerts, setAlerts] = useState<string[]>([]);
  const [geoUnavailable, setGeoUnavailable] = useState(false);
  const trucks = monitor.trucks ?? data.trucks;
  const routes = monitor.optimized_routes ?? data.routes;
  const prioritizedZones = monitor.prioritized_zones ?? data.prioritized_zones ?? [];
  const proximityAlerts = monitor.proximity_alerts ?? [];

  const isConductor = session.role === "conductor";

  // El camión propio se identifica por el nombre del conductor: es lo que
  // guarda la ficha del camión, no el id del usuario.
  const myTruck = useMemo(
    () => data.trucks.find(truck => String(truck.driver ?? "").trim().toLowerCase() === String(session.name ?? "").trim().toLowerCase()),
    [data.trucks, session.name]
  );

  const sessionZone = useMemo(
    () => data.zones.find(zone => zone.name.trim().toLowerCase() === String(session.zone ?? "").trim().toLowerCase()),
    [data.zones, session.zone]
  );

  // Un conductor solo sigue las rutas de su propio camión: el resto es ruido.
  const visibleRoutes = useMemo(() => {
    if (!isConductor || !myTruck) return routes;
    return routes.filter(route => String(route.truck ?? "").toLowerCase() === String(myTruck.code ?? "").toLowerCase());
  }, [routes, isConductor, myTruck]);

  const nearbyTruckCodes = useMemo(
    () => proximityAlerts.map(alert => alert.truck_code).filter(Boolean) as string[],
    [proximityAlerts]
  );

  useEffect(() => {
    let active = true;
    function load() {
      fetch(`${geoBase}/alerts`)
        .then(response => {
          if (!response.ok) throw new Error("Servicio de geolocalización no disponible");
          return response.json();
        })
        .then(payload => {
          if (!active) return;
          setGeoUnavailable(false);
          setAlerts(Array.isArray(payload.alerts) ? payload.alerts : []);
        })
        .catch(() => {
          if (!active) return;
          setAlerts([]);
          setGeoUnavailable(true);
        });
    }
    load();
    const interval = window.setInterval(load, GEO_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className="two-col">
        <Panel icon={<Icon name="map" />} title="Mapa operativo">
          <MapView
            zones={data.zones}
            trucks={trucks}
            routes={routes}
            prioritizedZones={prioritizedZones}
            focusZone={sessionZone}
            nearbyTruckCodes={nearbyTruckCodes}
          />
        </Panel>
        <Panel icon={<Icon name="truck" />} title="Seguimiento GPS">
          {geoUnavailable && (
            <p className="hint error" role="alert">
              El servicio de alertas de geolocalización no responde. El seguimiento sigue disponible, pero sin sus avisos.
            </p>
          )}
          {isConductor && myTruck && (
            <p className="hint">Mostrando las rutas de tu camión: <strong>{myTruck.code}</strong></p>
          )}
          <div className="list">
            {visibleRoutes.map(route => (
              <Item
                key={route.id}
                title={`${route.truck} - ${route.zone}`}
                detail={`Avance ${route.progress}% | ETA ${route.eta} | ${route.delay}`}
                color={route.delay.includes("Retraso") ? "yellow" : "green"}
              />
            ))}
            {visibleRoutes.length === 0 && (
              <EmptyState message={isConductor ? "No hay rutas activas para tu camión." : "No hay rutas activas."} />
            )}
            {alerts.map(alert => (
              <Item key={alert} title="Microservicio TS" detail={alert} color="neutral" />
            ))}
          </div>
        </Panel>
      </div>

      <Panel icon={<Icon name="alert" />} title="Alertas de proximidad">
        <ProximityPanel alerts={proximityAlerts} role={session.role} zone={session.zone} />
      </Panel>

      {isConductor && onCreateCollection && (
        <CollectionForm
          data={data}
          myTruck={myTruck}
          defaultZoneId={sessionZone?.id}
          onCreateCollection={onCreateCollection}
        />
      )}
    </>
  );
}

/**
 * Registro de la recolección realizada.
 *
 * El endpoint `POST /api/collections` está restringido al rol conductor, así
 * que este formulario es el único punto de entrada de la aplicación. Sin él la
 * recolección solo podía crearse llamando a la API a mano.
 */
function CollectionForm({
  data,
  myTruck,
  defaultZoneId,
  onCreateCollection,
}: {
  data: Bootstrap;
  myTruck?: Bootstrap["trucks"][number];
  defaultZoneId?: number;
  onCreateCollection: (payload: { truck_id: number; zone_id: number; kg: number }) => Promise<void>;
}) {
  // Un conductor solo puede registrar con su propio camión; si la flota aún no
  // lo asocia a ninguno, se ofrece la lista completa en vez de bloquearlo.
  const truckOptions = myTruck ? [myTruck] : data.trucks;
  const [truckId, setTruckId] = useState<string>("");
  const [zoneId, setZoneId] = useState<string>("");
  const [kg, setKg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTruckId(String(myTruck?.id ?? data.trucks[0]?.id ?? ""));
  }, [myTruck, data.trucks]);

  useEffect(() => {
    setZoneId(String(defaultZoneId ?? data.zones[0]?.id ?? ""));
  }, [defaultZoneId, data.zones]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const kilos = Number(kg);
    if (!truckId || !zoneId) {
      setError("Selecciona un camión y una zona.");
      return;
    }
    if (!Number.isFinite(kilos) || kilos <= 0) {
      setError("Indica cuántos kilogramos se recogieron.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onCreateCollection({ truck_id: Number(truckId), zone_id: Number(zoneId), kg: kilos });
      setKg("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar la recolección");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel
      icon={<Icon name="check" />}
      title={myTruck ? `Registrar recolección · ${myTruck.code}` : "Registrar recolección"}
    >
      <form className="form-grid" onSubmit={submit} noValidate>
        <label htmlFor="collection-truck">Camión
          <Select
            id="collection-truck"
            value={truckId}
            onChange={setTruckId}
            options={truckOptions.map(truck => ({ value: String(truck.id), label: `${truck.code} · ${truck.driver}` }))}
            placeholder="Selecciona un camión"
          />
        </label>
        <label htmlFor="collection-zone">Zona
          <Select
            id="collection-zone"
            value={zoneId}
            onChange={setZoneId}
            options={data.zones.map(zone => ({ value: String(zone.id), label: zone.name }))}
            placeholder="Selecciona una zona"
          />
        </label>
        <label htmlFor="collection-kg">Kilogramos recolectados
          <input
            id="collection-kg"
            type="number"
            min={1}
            required
            value={kg}
            placeholder="Ej. 320"
            onChange={event => setKg(event.currentTarget.value)}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? "Registrando..." : "Registrar recolección"}
          </button>
        </div>
      </form>
      {error && <p className="hint error" role="alert">{error}</p>}
    </Panel>
  );
}

export default Routes;
