import React, { useEffect, useState } from "react";
import { Bootstrap, Monitor } from "../types";
import { Icon } from "../components/Icon";
import { Panel } from "../components/Panel";
import { MapView } from "../components/MapView";
import Item from "../components/Item";
import { geoBase } from "../constants";

export function Routes({ data, monitor }: { data: Bootstrap; monitor: Monitor }) {
  const [alerts, setAlerts] = useState<string[]>([]);
  const trucks = monitor.trucks ?? data.trucks;
  const routes = monitor.optimized_routes ?? data.routes;
  const prioritizedZones = monitor.prioritized_zones ?? data.prioritized_zones ?? [];

  useEffect(() => {
    fetch(`${geoBase}/alerts`).then(response => response.json()).then(payload => setAlerts(payload.alerts ?? [])).catch(() => setAlerts([]));
  }, []);

  return (
    <div className="two-col">
      <Panel icon={<Icon name="map" />} title="Mapa operativo">
        <MapView zones={data.zones} trucks={trucks} routes={routes} prioritizedZones={prioritizedZones} />
      </Panel>
      <Panel icon={<Icon name="truck" />} title="Seguimiento GPS">
        <div className="list">
          {routes.map(route => <Item key={route.id} title={`${route.truck} - ${route.zone}`} detail={`Avance ${route.progress}% | ETA ${route.eta} | ${route.delay}`} color={route.delay.includes("Retraso") ? "yellow" : "blue"} />)}
          {alerts.map(alert => <Item key={alert} title="Microservicio TS" detail={alert} color="blue" />)}
        </div>
      </Panel>
    </div>
  );
}

export default Routes;
