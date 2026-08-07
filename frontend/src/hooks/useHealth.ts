import { useEffect, useState } from 'react';
import { request } from '../api';

export type Health = {
  status: string;
  database: string;
  version: string;
  mode: string;
};

/**
 * Estado del servicio, para el panel de administración.
 *
 * Se pide una vez al montar: el modo de base de datos y la versión no cambian
 * mientras la sesión está abierta, así que sondearlos sería gasto puro.
 *
 * Devuelve `null` si no se pudo consultar; la vista lo muestra como
 * "desconectado" en lugar de inventar un estado.
 */
export function useHealth(enabled: boolean) {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHealth(null);
      return;
    }
    let active = true;
    request<Health>('/health')
      .then((payload) => {
        if (active) setHealth(payload);
      })
      .catch(() => {
        if (active) setHealth(null);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return health;
}

export default useHealth;
