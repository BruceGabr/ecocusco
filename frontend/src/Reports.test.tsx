import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

vi.mock("leaflet", () => ({
  default: {
    map: () => ({ setView: () => ({ addLayer: () => ({ remove: () => {} }) }) }),
    tileLayer: () => ({ addTo: () => {} }),
    layerGroup: () => ({ addTo: () => ({ remove: () => {} }) }),
    marker: () => ({ bindPopup: () => ({ addTo: () => {} }) }),
    circleMarker: () => ({ bindPopup: () => ({ addTo: () => {} }) }),
    circle: () => ({ bindPopup: () => ({ addTo: () => {} }) }),
    icon: () => ({}),
  },
}));

import { App } from "./main";

const session = {
  id: 1,
  name: "Administrador EcoCusco",
  email: "admin@ecocusco.pe",
  role: "admin",
  zone: "Centro Historico",
};

describe("Reports view", () => {
  beforeEach(() => {
    if (typeof window.matchMedia !== "function") {
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(key => delete store[key]); },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() { return Object.keys(store).length; },
    };
    Object.defineProperty(globalThis, "localStorage", { value: mockStorage, configurable: true, writable: true });
    globalThis.localStorage.clear();
    globalThis.localStorage.setItem("sir-session", JSON.stringify(session));
    globalThis.localStorage.setItem("sir-token", "fake-token");
  });

  it("renders the reports view without crashing", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        zones: [{ id: 1, name: "Centro Historico", latitude: -13.5166, longitude: -71.9789, criticality: "Alta" }],
        schedules: [],
        trucks: [
          { code: "C-02", zone: "Wanchaq", latitude: -13.5241, longitude: -71.9546, progress: 72, etaMinutes: 12 },
        ],
        routes: [],
        reports: [
          { id: 1, citizen: "Ana Quispe", zone: "Wanchaq", type: "Acumulacion de basura", detail: "Contenedor lleno", status: "En revision" },
        ],
        collections: [],
        analytics: { zones: 1, active_trucks: 1, open_reports: 1, confirmed_collections: 0, total_kg: 100, compliance: 90 },
      }),
      status: 200,
    })) as unknown as typeof fetch;

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Reportes/i }));
    await screen.findByRole("heading", { name: /Registrar incidencia/i });
    expect(screen.getByText(/Seguimiento/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Acumulacion de basura/i).length).toBeGreaterThan(0);
  });
});
