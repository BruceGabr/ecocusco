import { useState } from 'react';
import { request } from '../api';
import { useBulkSelection } from './useBulkSelection';

/** Catálogos que admiten borrado masivo. Debe coincidir con `DELETERS` del backend. */
export type BulkResource =
  | 'users'
  | 'zones'
  | 'schedules'
  | 'trucks'
  | 'maintenance';

export type BulkDeleteResult = {
  resource: BulkResource;
  deleted: number[];
  failed: number[];
  count: number;
};

/**
 * Selección múltiple más la llamada de borrado masivo.
 *
 * Se agrupa aquí porque los cinco paneles de administración repiten el mismo
 * ciclo: seleccionar, pedir `/admin/bulk-action`, quitar de la lista local lo
 * que el backend confirme y limpiar la selección.
 *
 * El backend responde qué ids se borraron y cuáles no, así que la lista local
 * se recorta con `deleted` en vez de asumir que fue todo.
 */
export function useBulkActions({
  resource,
  availableIds,
}: {
  resource: BulkResource;
  availableIds: number[];
}) {
  const selection = useBulkSelection(availableIds);
  const [busy, setBusy] = useState(false);

  async function deleteSelected(): Promise<BulkDeleteResult> {
    setBusy(true);
    try {
      const result = await request<BulkDeleteResult>('/admin/bulk-action', {
        method: 'POST',
        body: JSON.stringify({
          resource,
          action: 'delete',
          ids: selection.selected,
        }),
      });
      selection.clear();
      return result;
    } finally {
      setBusy(false);
    }
  }

  return { ...selection, busy, deleteSelected };
}

export default useBulkActions;
