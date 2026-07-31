import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3100);

const trucks = [
  { code: "C-01", zone: "Centro Historico", latitude: -13.5166, longitude: -71.9789, progress: 86, etaMinutes: 5 },
  { code: "C-02", zone: "Wanchaq", latitude: -13.5256, longitude: -71.9558, progress: 62, etaMinutes: 12 },
  { code: "C-04", zone: "Santiago", latitude: -13.5350, longitude: -71.9847, progress: 31, etaMinutes: 28 }
];

function json(data: unknown, status = 200) {
  return {
    status,
    body: JSON.stringify(data),
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  };
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  let response: ReturnType<typeof json>;

  if (url.pathname === "/health" || url.pathname === "/api/health") {
    response = json({ status: "ok", service: "geo-alerts" });
  } else if (url.pathname === "/truck-locations" || url.pathname === "/api/truck-locations") {
    response = json({ trucks });
  } else if (url.pathname === "/alerts" || url.pathname === "/api/alerts") {
    response = json({
      alerts: trucks.map(truck => `${truck.code} llegara a ${truck.zone} en ${truck.etaMinutes} min`)
    });
  } else if (url.pathname === "/eta" || url.pathname === "/api/eta") {
    const code = url.searchParams.get("truck");
    const truck = trucks.find(item => item.code === code) ?? trucks[0];
    response = json({ truck: truck.code, etaMinutes: truck.etaMinutes, eta: `${truck.etaMinutes} min` });
  } else {
    response = json({ error: "Ruta no encontrada" }, 404);
  }

  res.writeHead(response.status, response.headers);
  res.end(response.body);
});

server.listen(port, () => {
  console.log(`Servicio TS de geolocalizacion disponible en http://localhost:${port}`);
});
