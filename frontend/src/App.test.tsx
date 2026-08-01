import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ChildProcess, spawn } from "child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("leaflet", () => ({
  default: {
    map: () => ({
      setView: () => {},
      addLayer: () => {},
      remove: () => {},
    }),
    tileLayer: () => ({ addTo: () => {} }),
    layerGroup: () => ({ addTo: () => ({ remove: () => {} }) }),
    marker: () => ({ bindPopup: () => ({ addTo: () => {} }) }),
    circleMarker: () => ({ bindPopup: () => ({ addTo: () => {} }) }),
    circle: () => ({ bindPopup: () => ({ addTo: () => {} }) }),
    icon: () => ({}),
  },
}));

import { App } from "./main";

declare global {
  interface Window {
    matchMedia: (query: string) => MediaQueryList;
  }
}

const backendPort = 8010;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "../../backend-python");
let backendProcess: ChildProcess | null = null;
let originalFetch: typeof fetch | undefined;

const sessionData = {
  id: 1,
  name: "Administrador EcoCusco",
  email: "admin@ecocusco.pe",
  role: "admin",
  zone: "Centro Historico",
};

const adminCredentials = {
  email: "admin@ecocusco.pe",
  password: "admin123",
};

async function authenticateAdmin() {
  const authResponse = await fetch(`${backendUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(adminCredentials),
  });

  const authPayload = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !authPayload?.token || !authPayload?.user) {
    throw new Error(`Admin authentication failed: ${authPayload?.detail ?? authResponse.statusText}`);
  }

  const token = authPayload.token as string;
  localStorage.setItem("sir-token", token);
  localStorage.setItem("sir-session", JSON.stringify(authPayload.user));

  const authCheck = await fetch(`${backendUrl}/api/operations/monitor`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!authCheck.ok) {
    const body = await authCheck.text().catch(() => "");
    throw new Error(`Authenticated monitor check failed: ${authCheck.status} ${body}`);
  }
}

async function waitForBackendReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${backendUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  if (backendProcess) {
    backendProcess.kill();
  }
  throw new Error("Backend did not become ready in time");
}

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

beforeAll(async () => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  }

  const venvPython = path.join(backendDir, ".venv", "Scripts", "python.exe");
  const pythonCmd = existsSync(venvPython) ? venvPython : process.env.PYTHON || "python";
  backendProcess = spawn(pythonCmd, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(backendPort)], {
    cwd: backendDir,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (backendProcess && backendProcess.stderr) {
    backendProcess.stderr.on("data", chunk => {
      const message = chunk.toString();
      if (message.toLowerCase().includes("error")) {
        // Log only errors to help diagnose issues during test runs.
        console.error(message);
      }
    });
  }

  await waitForBackendReady();
  originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo, init?: RequestInit) => {
    const originalUrl = typeof input === "string" ? input : input.url;
    let targetUrl = originalUrl;
    if (targetUrl.startsWith("/api")) {
      targetUrl = `${backendUrl}${targetUrl}`;
    }
    return originalFetch!(targetUrl, init);
  }) as typeof fetch;
});

afterAll(async () => {
  cleanup();
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

/**
 * Los desplegables usan el componente Select propio (combobox + listbox), no un
 * <select> nativo, así que se interactúa abriendo la lista y eligiendo opción
 * en vez de con fireEvent.change.
 */
function chooseOption(label: RegExp | string, optionName: RegExp | string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

/** Elige la primera opción de la lista (equivale al primer registro del catálogo). */
function chooseFirstOption(label: RegExp | string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getAllByRole("option")[0]);
}

/** Administración está organizada por pestañas: solo se monta el panel activo. */
async function openAdminTab(name: string) {
  // findBy*: al entrar en Administración los datos pueden seguir cargando,
  // así que la pestaña todavía no está montada.
  fireEvent.click(await screen.findByRole("tab", { name }));
}

describe("App e2e integration", () => {
  it("loads the real backend and performs a route update", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));
    await openAdminTab("Eventos");
    await screen.findByRole("heading", { name: /Eventos operativos/i });

    chooseOption(/Tipo de evento/i, /Actualización de ruta/i);
    chooseFirstOption(/Objetivo/i);
    fireEvent.change(screen.getByLabelText(/Progreso/i), { target: { value: "92" } });
    fireEvent.change(screen.getByLabelText(/Retraso/i), { target: { value: "Retraso leve" } });

    fireEvent.click(screen.getByRole("button", { name: /Enviar evento/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Evento operativo registrado y monitoreo actualizado/i));
    expect(screen.getByText(/C-02 - Wanchaq/i)).toBeInTheDocument();
  });

  it("loads the real backend and performs a container update", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));
    await openAdminTab("Eventos");
    await screen.findByRole("heading", { name: /Eventos operativos/i });

    chooseOption(/Tipo de evento/i, /Actualización de contenedor/i);
    chooseFirstOption(/Objetivo/i);
    fireEvent.change(screen.getByLabelText(/Llenado/i), { target: { value: "95" } });
    const statusInput = screen.getAllByLabelText(/Estado/i)[0];
    fireEvent.change(statusInput, { target: { value: "Lleno" } });

    fireEvent.click(screen.getByRole("button", { name: /Enviar evento/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Evento operativo registrado y monitoreo actualizado/i));
    expect(screen.getAllByText(/Contenedor Centro/i).length).toBeGreaterThan(0);
  });

  it("allows a user to reset a password from the forgot-password form", async () => {
    // Se usa una cuenta desechable en vez de la de administrador: al mutar la
    // contraseña compartida, cualquier fallo en la restauración dejaba rotos
    // todos los tests posteriores, que hacen authenticateAdmin().
    const throwawayEmail = `reset-${Date.now()}@ecocusco.pe`;
    await fetch(`${backendUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Usuario Reset",
        email: throwawayEmail,
        password: "initialPass123",
        role: "ciudadano",
        zone: "Centro Historico",
      }),
    });

    const forgotResponse = await fetch(`${backendUrl}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: throwawayEmail }),
    });
    const forgotPayload = await forgotResponse.json();
    const token = forgotPayload.token as string;

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Recuperar contraseña/i }));
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value: throwawayEmail } });
    fireEvent.change(screen.getByLabelText(/Token de recuperación/i), { target: { value: token } });
    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), { target: { value: "newPassword123" } });
    fireEvent.click(screen.getByRole("button", { name: /Restablecer contraseña/i }));

    await waitFor(() => expect(screen.getByText(/Contraseña actualizada correctamente/i)).toBeInTheDocument());
    // No hace falta restaurar nada: la cuenta admin no se tocó.
  });

  it("shows the admin users management panel for admins", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: /Gestión de usuarios/i })).toBeInTheDocument());
  });

  it("shows CRUD forms for zones, schedules, trucks, and maintenance", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));

    // Cada sección vive en su pestaña, con una única acción principal visible.
    await openAdminTab("Zonas");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Gestión de zonas/i })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Crear zona/i })).toBeInTheDocument();

    await openAdminTab("Horarios");
    await waitFor(() => expect(screen.getByRole("button", { name: /Crear horario/i })).toBeInTheDocument());

    await openAdminTab("Camiones");
    await waitFor(() => expect(screen.getByRole("button", { name: /Crear camión/i })).toBeInTheDocument());

    await openAdminTab("Mantenimiento");
    await waitFor(() => expect(screen.getByRole("button", { name: /Crear mantenimiento/i })).toBeInTheDocument());
  });

  it("allows admins to edit and delete a zone from the admin panel", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));

    await openAdminTab("Zonas");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Gestión de zonas/i })).toBeInTheDocument());
    const editButtons = screen.getAllByRole("button", { name: /Editar zona/i });
    fireEvent.click(editButtons[0]);
    fireEvent.change(screen.getByLabelText(/Nombre de la zona/i), { target: { value: "Cusco Actualizado" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/i }));

    await waitFor(() => expect(screen.getAllByText(/Cusco Actualizado/i).length).toBeGreaterThan(0));

    const deleteButtons = screen.getAllByRole("button", { name: /Eliminar zona/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => expect(screen.queryByText(/Cusco Actualizado/i)).not.toBeInTheDocument());
  });

  it("shows a filter input for zones in the admin panel", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));

    await openAdminTab("Zonas");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Gestión de zonas/i })).toBeInTheDocument());
    // Los filtros son desplegables del catálogo, no búsqueda de texto libre.
    expect(screen.getByRole("combobox", { name: /Zona/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Criticidad/i })).toBeInTheDocument();
  });

  it("shows truck search and status filters in the admin panel", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));

    await openAdminTab("Camiones");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Gestión de camiones/i })).toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: /Estado/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Zona/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Conductor/i })).toBeInTheDocument();
  });

  it("shows maintenance status filters in the admin panel", async () => {
    await authenticateAdmin();

    render(<App />);

    await screen.findByRole("heading", { name: /Panel Principal/i });
    fireEvent.click(screen.getByRole("button", { name: /Administración/i }));

    await openAdminTab("Mantenimiento");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Gestión de mantenimiento/i })).toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: /Estado/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Camión/i })).toBeInTheDocument();
  });
});
