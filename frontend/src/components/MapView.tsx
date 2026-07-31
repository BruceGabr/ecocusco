import React, { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Route, Truck, Zone } from "../types";

type PrioritizedZone = { id: number; name: string; priority_score: number; criticality: string; latitude?: number; longitude?: number };

export function MapView({ zones, trucks, routes, prioritizedZones }: { zones: Zone[]; trucks: Truck[]; routes: Route[]; prioritizedZones: PrioritizedZone[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const signature = useMemo(() => JSON.stringify({ zones, trucks, routes, prioritizedZones }), [zones, trucks, routes, prioritizedZones]);

  useEffect(() => {
    if (!ref.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(ref.current).setView([-13.532, -71.967], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(mapRef.current);
    }
    const layer = L.layerGroup().addTo(mapRef.current);
    zones.forEach(zone => L.marker([zone.latitude, zone.longitude]).bindPopup(`${zone.name} - ${zone.criticality}`).addTo(layer));
    prioritizedZones.forEach(zone => {
      const lat = zone.latitude ?? zones.find(item => item.name === zone.name)?.latitude;
      const lon = zone.longitude ?? zones.find(item => item.name === zone.name)?.longitude;
      if (lat !== undefined && lon !== undefined) {
        L.circleMarker([lat, lon], { radius: 12, color: zone.priority_score >= 5 ? "#c94735" : "#f5b942", fillColor: zone.priority_score >= 5 ? "#c94735" : "#f5b942", fillOpacity: 0.9, weight: 3 }).bindPopup(`${zone.name} · Prioridad ${zone.priority_score}`).addTo(layer);
      }
    });
    trucks.forEach(truck => L.circleMarker([truck.latitude, truck.longitude], { radius: 8, color: "#f5b942", fillOpacity: 0.9 }).bindPopup(`${truck.code} - ${truck.status}`).addTo(layer));
    routes.forEach(route => L.circle([route.latitude, route.longitude], { radius: 450, color: route.delay.includes("Retraso") ? "#c94735" : "#0f8b8d" }).bindPopup(`${route.truck}: ${route.eta}`).addTo(layer));
    return () => { layer.remove(); };
  }, [signature]);

  return <div className="map-wrapper" ref={ref} />;
}

export default MapView;
