import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Los iconos se importan para que Vite los incluya en el bundle y devuelva su
// URL definitiva. Leaflet, por defecto, los pide como rutas relativas a la raíz
// del sitio (/marker-icon.png), que en el despliegue no existen: en producción
// daban 404 y los marcadores de zona salían sin icono.
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { Route, Truck, Zone } from '../types';

// `Icon.Default` sobreescribe `_getIconUrl` para anteponer una ruta que
// autodetecta desde la hoja de estilos. Eso corrompería las URLs que Vite
// genera, así que se elimina para que Leaflet use el método base, que
// devuelve la opción tal cual (y sigue eligiendo la versión retina).
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
});

/** Colores del mapa. Estaban repetidos como hexadecimales sueltos. */
const MAP_COLORS = {
  critical: '#c94735',
  warning: '#f5b942',
  normal: '#0f8b8d',
  /** Zona propia del usuario y su radio de proximidad. */
  focus: '#2563eb',
} as const;

/**
 * Radio en metros del círculo de proximidad que se dibuja alrededor de la zona
 * del usuario. Debe coincidir con `PROXIMITY_RADIUS_M` del backend: si no, el
 * mapa promete una cobertura distinta de la que dispara los avisos.
 */
const PROXIMITY_RADIUS_M = 500;

/** Puntaje a partir del cual una zona se dibuja como crítica. */
const CRITICAL_PRIORITY_SCORE = 5;

/** Radio en metros del área que se resalta alrededor de cada ruta. */
const ROUTE_AREA_RADIUS_M = 450;

/** Vista inicial: centro de la ciudad del Cusco. */
const CUSCO_CENTER: L.LatLngExpression = [-13.532, -71.967];
const INITIAL_ZOOM = 12;

type PrioritizedZone = {
  id: number;
  name: string;
  priority_score: number;
  criticality: string;
  latitude?: number;
  longitude?: number;
};

/** Marcador de camión: un glifo, no un círculo más entre los de zona. */
function truckIcon(isNearby: boolean): L.DivIcon {
  return L.divIcon({
    className: `map-truck-marker${isNearby ? ' nearby' : ''}`,
    html: '<span aria-hidden="true">🚛</span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export function MapView({
  zones,
  trucks,
  routes,
  prioritizedZones,
  focusZone,
  nearbyTruckCodes = [],
}: {
  zones: Zone[];
  trucks: Truck[];
  routes: Route[];
  prioritizedZones: PrioritizedZone[];
  /** Zona del usuario: se marca y se rodea con el radio de proximidad. */
  focusZone?: Zone;
  /** Códigos de camión con aviso de proximidad activo: se pintan en rojo. */
  nearbyTruckCodes?: string[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const nearbySet = useMemo(
    () => new Set(nearbyTruckCodes.map((code) => String(code).toLowerCase())),
    [nearbyTruckCodes],
  );
  const signature = useMemo(
    () =>
      JSON.stringify({
        zones,
        trucks,
        routes,
        prioritizedZones,
        focusZone,
        nearbyTruckCodes,
      }),
    [zones, trucks, routes, prioritizedZones, focusZone, nearbyTruckCodes],
  );

  useEffect(() => {
    if (!ref.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current).setView(CUSCO_CENTER, INITIAL_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }

    const layer = L.layerGroup().addTo(mapRef.current);

    zones.forEach((zone) =>
      L.marker([zone.latitude, zone.longitude])
        .bindPopup(`${zone.name} - ${zone.criticality}`)
        .addTo(layer),
    );

    prioritizedZones.forEach((zone) => {
      const source = zones.find((item) => item.name === zone.name);
      const lat = zone.latitude ?? source?.latitude;
      const lon = zone.longitude ?? source?.longitude;
      if (lat === undefined || lon === undefined) return;
      const color =
        zone.priority_score >= CRITICAL_PRIORITY_SCORE
          ? MAP_COLORS.critical
          : MAP_COLORS.warning;
      L.circleMarker([lat, lon], {
        radius: 12,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 3,
      })
        .bindPopup(`${zone.name} · Prioridad ${zone.priority_score}`)
        .addTo(layer);
    });

    // La zona propia se dibuja antes que los camiones para que su círculo no
    // tape los marcadores.
    if (focusZone) {
      L.circleMarker([focusZone.latitude, focusZone.longitude], {
        radius: 10,
        color: MAP_COLORS.focus,
        fillColor: MAP_COLORS.focus,
        fillOpacity: 0.95,
        weight: 3,
      })
        .bindPopup(`Tu zona: ${focusZone.name}`)
        .addTo(layer);
      L.circle([focusZone.latitude, focusZone.longitude], {
        radius: PROXIMITY_RADIUS_M,
        color: MAP_COLORS.focus,
        fillColor: MAP_COLORS.focus,
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6 4',
      })
        .bindPopup(`Radio de proximidad (${PROXIMITY_RADIUS_M} m)`)
        .addTo(layer);
    }

    trucks.forEach((truck) => {
      const isNearby = nearbySet.has(String(truck.code ?? '').toLowerCase());
      const detail = [truck.driver, truck.zone, truck.status]
        .filter(Boolean)
        .join(' · ');
      L.marker([truck.latitude, truck.longitude], { icon: truckIcon(isNearby) })
        .bindPopup(
          `<strong>${truck.code}</strong>${detail ? `<br>${detail}` : ''}${
            isNearby ? '<br>Cerca de tu zona' : ''
          }`,
        )
        .addTo(layer);
    });

    routes.forEach((route) =>
      L.circle([route.latitude, route.longitude], {
        radius: ROUTE_AREA_RADIUS_M,
        color: route.delay.includes('Retraso')
          ? MAP_COLORS.critical
          : MAP_COLORS.normal,
      })
        .bindPopup(`${route.truck}: ${route.eta}`)
        .addTo(layer),
    );

    return () => {
      layer.remove();
    };
  }, [signature, nearbySet]);

  return <div className="map-wrapper" ref={ref} />;
}

export default MapView;
