import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { Operations } from "./views/Operations";

const dataMock = {
  zones: [],
  schedules: [],
  trucks: [],
  routes: [
    { id: 1, truck: "C-01", zone: "Centro Historico", progress: 40, eta: "10 min", delay: "Sin retraso", latitude: -13.5166, longitude: -71.9789 },
  ],
  reports: [],
  collections: [],
  analytics: { zones: 1, active_trucks: 1, open_reports: 0, confirmed_collections: 0, total_kg: 0, compliance: 100 },
  containers: [
    { id: 1, zone_id: 1, name: "Contenedor Centro", fill_level: 60, status: "Operativo", updated_at: "2026-07-19T00:00:00.000Z" },
  ],
  maintenance: [],
  notifications: [],
  prioritized_zones: [],
  optimized_routes: [],
  truck_assignments: [],
  intervention_plan: [],
};

const monitorMock = {
  containers: [
    { id: 1, zone_id: 1, name: "Contenedor Centro", fill_level: 60, status: "Operativo", updated_at: "2026-07-19T00:00:00.000Z" },
  ],
  notifications: [],
};

describe("Operations component", () => {
  it("renders event form and sends payload on submit", async () => {
    const mockUpdate = vi.fn(async () => Promise.resolve());

    render(<Operations data={dataMock} monitor={monitorMock} onOperationUpdate={mockUpdate} />);

    expect(screen.getByRole("heading", { name: /Eventos operativos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo de evento/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tipo de evento/i), { target: { value: "container_update" } });
    fireEvent.change(screen.getByLabelText(/Objetivo/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/Llenado/i), { target: { value: "95" } });
    fireEvent.change(screen.getByLabelText(/Estado/i), { target: { value: "Lleno" } });

    fireEvent.click(screen.getByRole("button", { name: /Enviar evento/i }));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ type: "container_update", id: 1, fill_level: 95, status: "Lleno" });
  });

  it("submits route update payload when route update is selected", async () => {
    const mockUpdate = vi.fn(async () => Promise.resolve());

    render(<Operations data={dataMock} monitor={monitorMock} onOperationUpdate={mockUpdate} />);

    expect(screen.getByRole("heading", { name: /Eventos operativos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo de evento/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tipo de evento/i), { target: { value: "route_update" } });
    const targetSelect = screen.getByLabelText(/Objetivo/i) as HTMLSelectElement;
    fireEvent.change(targetSelect, { target: { value: "1" } });
    expect(targetSelect.value).toBe("1");
    fireEvent.change(screen.getByLabelText(/Progreso/i), { target: { value: "72" } });
    fireEvent.change(screen.getByLabelText(/Retraso/i), { target: { value: "Retraso leve" } });

    fireEvent.click(screen.getByRole("button", { name: /Enviar evento/i }));

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ type: "route_update", id: 1, progress: 72, delay: "Retraso leve" });
  });
});
