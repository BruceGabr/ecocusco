import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

vi.mock('leaflet', () => import('./test-utils/leaflet-mock'));

import { App } from './main';

/**
 * Con una sesión que el backend ya no acepta, la aplicación se quedaba
 * atascada: el token seguía en localStorage, el monitoreo reintentaba cada 10
 * segundos y la consola se llenaba de 401 sin que el usuario supiera qué pasaba.
 *
 * Ocurre al caducar el token, que dura 12 horas, y también al apuntar el
 * frontend a otro backend, porque cada uno firma con su propia clave.
 */
describe('sesión rechazada por el backend', () => {
  const session = {
    id: 1,
    name: 'Administrador EcoCusco',
    email: 'admin@ecocusco.pe',
    role: 'admin',
    zone: 'Centro Historico',
  };

  beforeEach(() => {
    localStorage.setItem('sir-session', JSON.stringify(session));
    localStorage.setItem('sir-token', 'token-de-otro-backend');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(typeof input === 'string' ? input : input.url);
        // Las zonas son públicas: la pantalla de acceso las necesita.
        if (url.includes('/zones')) {
          return { ok: true, status: 200, statusText: 'OK', json: async () => [] };
        }
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ detail: 'Token inválido' }),
        };
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('devuelve al formulario de acceso y lo explica', async () => {
    render(<App />);

    // El encabezado identifica la pantalla sin ambigüedad: hay dos botones
    // "Iniciar sesión", la pestaña y el de envío del formulario.
    await screen.findByRole('heading', { name: /Bienvenido de vuelta/i });
    expect(await screen.findByText(/Tu sesión expiró/i)).toBeInTheDocument();
  });

  it('borra la sesión guardada para no reintentar con un token muerto', async () => {
    render(<App />);

    await waitFor(() => {
      expect(localStorage.getItem('sir-token')).toBeNull();
      expect(localStorage.getItem('sir-session')).toBeNull();
    });
  });
});
