import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionRefresh } from './useSessionRefresh';

/** Debe coincidir con CHECK_INTERVAL_MS del hook. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

describe('renovación de sesión por actividad', () => {
  let onExpired: Mock<() => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    onExpired = vi.fn<() => void>();
    localStorage.setItem('sir-token', 'token-inicial');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function stubFetch(response: { ok: boolean; status: number; body?: unknown }) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      statusText: String(response.status),
      json: async () => response.body ?? {},
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function simulateActivity() {
    window.dispatchEvent(new Event('pointerdown'));
  }

  async function advanceOneCycle() {
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
  }

  // --- Sin actividad no se renueva: así caduca sola la sesión inactiva ---
  it('no renueva si nadie tocó la aplicación', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { token: 'nuevo' } });

    renderHook(() => useSessionRefresh(true, onExpired));
    await advanceOneCycle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sir-token')).toBe('token-inicial');
  });

  // --- Con actividad se renueva y se guarda el token nuevo ---
  it('renueva y guarda el token cuando hubo actividad', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { token: 'token-renovado' },
    });

    renderHook(() => useSessionRefresh(true, onExpired));
    simulateActivity();
    await advanceOneCycle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/auth/refresh');
    expect(localStorage.getItem('sir-token')).toBe('token-renovado');
  });

  // --- La actividad se consume: un solo clic no renueva para siempre ---
  it('vuelve a exigir actividad tras cada renovación', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { token: 'x' } });

    renderHook(() => useSessionRefresh(true, onExpired));
    simulateActivity();
    await advanceOneCycle();
    await advanceOneCycle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // --- Un 401 cierra la sesión: token caducado o tope absoluto alcanzado ---
  it('avisa de sesión expirada y deja de renovar ante un 401', async () => {
    const fetchMock = stubFetch({
      ok: false,
      status: 401,
      body: { detail: 'Sesión inválida o expirada' },
    });

    renderHook(() => useSessionRefresh(true, onExpired));
    simulateActivity();
    await advanceOneCycle();

    expect(onExpired).toHaveBeenCalledTimes(1);

    simulateActivity();
    await advanceOneCycle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // --- Un corte de red no cierra la sesión: se reintenta ---
  it('reintenta tras un fallo de red sin cerrar la sesión', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useSessionRefresh(true, onExpired));
    simulateActivity();
    await advanceOneCycle();

    expect(onExpired).not.toHaveBeenCalled();

    await advanceOneCycle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // --- Sin sesión no se sondea nada ---
  it('no hace nada mientras no haya sesión', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { token: 'x' } });

    renderHook(() => useSessionRefresh(false, onExpired));
    simulateActivity();
    await advanceOneCycle();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
