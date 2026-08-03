import { useCallback, useEffect, useRef } from 'react';
import { ApiError, request } from '../api';
import { Session } from '../types';

/**
 * Cada cuánto se comprueba si toca renovar. Debe quedar holgadamente por
 * debajo de la vida del token (30 min en el backend) para que la renovación
 * ocurra mucho antes de que caduque.
 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Eventos que cuentan como uso real de la aplicación. */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'scroll',
  'touchstart',
] as const;

type RefreshResponse = {
  token?: string;
  user?: Session;
  session_expires_at?: string;
};

/**
 * Mantiene viva la sesión mientras la persona usa la aplicación.
 *
 * El token dura poco y solo se renueva si hubo actividad desde la última
 * comprobación. Si el usuario deja la pestaña abierta pero no la toca, nadie
 * pide la renovación y el token caduca solo: así el cierre por inactividad no
 * necesita ningún temporizador en el servidor.
 *
 * El tope absoluto lo aplica el backend; aquí solo se reacciona a su rechazo.
 */
export function useSessionRefresh(enabled: boolean, onExpired: () => void) {
  const hadActivity = useRef(false);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  const markActivity = useCallback(() => {
    hadActivity.current = true;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActivity);
      }
    };
  }, [enabled, markActivity]);

  useEffect(() => {
    if (!enabled) {
      hadActivity.current = false;
      return;
    }

    let active = true;
    let interval = 0;

    const stop = () => {
      active = false;
      if (interval) window.clearInterval(interval);
    };

    const tick = async () => {
      // Sin actividad no se renueva: es lo que hace que la sesión caduque
      // sola tras un rato sin usarla.
      if (!hadActivity.current) return;
      hadActivity.current = false;

      try {
        const payload = await request<RefreshResponse>('/auth/refresh', {
          method: 'POST',
        });
        if (!active || !payload.token) return;
        localStorage.setItem('sir-token', payload.token);
        if (payload.user) {
          localStorage.setItem('sir-session', JSON.stringify(payload.user));
        }
      } catch (error) {
        if (!active) return;
        // 401 aquí significa token caducado o sesión pasada del tope absoluto.
        if (error instanceof ApiError && error.isUnauthorized) {
          stop();
          onExpiredRef.current();
          return;
        }
        // Un fallo de red es transitorio: se reintenta en el siguiente ciclo.
        hadActivity.current = true;
      }
    };

    interval = window.setInterval(tick, CHECK_INTERVAL_MS);
    return stop;
  }, [enabled]);
}
