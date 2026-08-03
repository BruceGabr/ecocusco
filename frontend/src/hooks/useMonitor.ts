import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, request } from '../api';
import { Monitor } from '../types';

/** Cada cuánto se refresca el monitoreo operativo, en milisegundos. */
const REFRESH_INTERVAL_MS = 10_000;

/**
 * Monitoreo operativo con refresco periódico.
 *
 * `enabled` evita sondear sin sesión: `/operations/monitor` incluye
 * notificaciones personales y exige autenticación, así que sin usuario cada
 * ciclo solo generaba un 401.
 *
 * `onUnauthorized` avisa cuando el backend rechaza el token. Antes el hook se
 * limitaba a registrar el error y seguía reintentando cada 10 segundos de forma
 * indefinida, así que una sesión caducada dejaba la aplicación atascada
 * inundando la consola.
 */
export function useMonitor(enabled: boolean, onUnauthorized?: () => void) {
  const [monitor, setMonitor] = useState<Monitor>({});

  // En una referencia para que cambiar el callback no reinicie el intervalo.
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const refresh = useCallback(async () => {
    const payload = await request<Monitor>('/operations/monitor');
    setMonitor(payload);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setMonitor({});
      return;
    }

    let active = true;
    let interval = 0;

    const stop = () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };

    const tick = () => {
      refresh().catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.isUnauthorized) {
          // La sesión no vale: se corta el sondeo y decide el contenedor.
          stop();
          onUnauthorizedRef.current?.();
          return;
        }
        console.error('No se pudo actualizar el monitoreo:', error);
      });
    };

    tick();
    interval = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return stop;
  }, [enabled, refresh]);

  return { monitor, setMonitor, refresh };
}
