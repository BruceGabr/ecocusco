import { useCallback, useEffect, useState } from 'react';
import { request } from '../api';
import { Monitor } from '../types';

/** Cada cuánto se refresca el monitoreo operativo, en milisegundos. */
const REFRESH_INTERVAL_MS = 10_000;

/**
 * Monitoreo operativo con refresco periódico.
 *
 * `enabled` evita sondear sin sesión: `/operations/monitor` incluye
 * notificaciones personales y ahora exige autenticación, así que sin usuario
 * cada ciclo solo generaba un 401 en la consola.
 */
export function useMonitor(enabled: boolean) {
  const [monitor, setMonitor] = useState<Monitor>({});

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
    const tick = () => {
      refresh().catch((error) => {
        if (active) console.error('No se pudo actualizar el monitoreo:', error);
      });
    };
    tick();
    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [enabled, refresh]);

  return { monitor, setMonitor, refresh };
}
