import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './api';

/**
 * `request` distinguía mal los fallos: cualquier respuesta de error se
 * convertía en un `Error` genérico, así que quien lo llamaba no podía saber si
 * el problema era la sesión (401) u otra cosa. Sin esa distinción la aplicación
 * no cerraba sesión al caducar el token y se quedaba reintentando.
 */
describe('cliente de la API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  /** Ejecuta la petición esperando que falle, y devuelve el ApiError tipado. */
  async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
    const error = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }

  function stubFetch(status: number, body: unknown = {}) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('marca como no autorizado el 401 del backend', async () => {
    stubFetch(401, { detail: 'Token inválido' });

    const error = await expectApiError(request('/bootstrap'));

    expect(error.status).toBe(401);
    expect(error.isUnauthorized).toBe(true);
    expect(error.message).toBe('Token inválido');
  });

  it('no marca como no autorizado otros errores del servidor', async () => {
    stubFetch(500, { detail: 'Boom' });

    const error = await expectApiError(request('/bootstrap'));

    expect(error.isUnauthorized).toBe(false);
  });

  it('convierte el fallo de red en un ApiError legible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    const error = await expectApiError(request('/bootstrap'));

    expect(error.isUnauthorized).toBe(false);
    expect(error.message).toMatch(/No se pudo conectar con el backend/);
  });

  it('adjunta el token de sesión cuando existe', async () => {
    const fetchMock = stubFetch(200, { ok: true });
    localStorage.setItem('sir-token', 'abc123');

    await request('/bootstrap');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc123');
  });

  it('no adjunta cabecera de autorización sin sesión', async () => {
    const fetchMock = stubFetch(200, { ok: true });

    await request('/zones');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});
