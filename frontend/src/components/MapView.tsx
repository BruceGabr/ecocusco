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
} as const;

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

export function MapView({
  zones,
  trucks,
  routes,
  prioritizedZones,
}: {
  zones: Zone[];
  trucks: Truck[];
  routes: Route[];
  prioritizedZones: PrioritizedZone[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const signature = useMemo(
    () => JSON.stringify({ zones, trucks, routes, prioritizedZones }),
    [zones, trucks, routes, prioritizedZones],
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

    trucks.forEach((truck) =>
      L.circleMarker([truck.latitude, truck.longitude], {
        radius: 8,
        color: MAP_COLORS.warning,
        fillOpacity: 0.9,
      })
        .bindPopup(`${truck.code} - ${truck.status}`)
        .addTo(layer),
    );

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
  }, [signature]);

  return <div className="map-wrapper" ref={ref} />;
}

export default MapView;
