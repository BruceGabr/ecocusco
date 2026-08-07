import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Selección múltiple de filas para las acciones masivas del panel admin.
 *
 * Guarda ids, no filas: la lista se recarga tras cada operación y comparar
 * objetos dejaría la selección apuntando a copias viejas.
 *
 * `availableIds` son los ids visibles ahora mismo (ya filtrados). Se usa para
 * "seleccionar todo" y para descartar de la selección lo que deje de estar en
 * pantalla: si no, un filtro podía ocultar una fila y borrarla igualmente.
 */
export function useBulkSelection(availableIds: number[]) {
  const [selected, setSelected] = useState<number[]>([]);

  const availableKey = availableIds.join(',');
  useEffect(() => {
    const available = new Set(availableIds);
    setSelected((current) => {
      const kept = current.filter((id) => available.has(id));
      return kept.length === current.length ? current : kept;
    });
    // availableKey identifica el contenido: la lista se recrea en cada render.
  }, [availableKey]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = useCallback((id: number) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }, []);

  const allSelected =
    availableIds.length > 0 && availableIds.every((id) => selectedSet.has(id));

  const toggleAll = useCallback(() => {
    setSelected((current) =>
      availableIds.every((id) => current.includes(id)) ? [] : [...availableIds],
    );
  }, [availableKey]);

  const clear = useCallback(() => setSelected([]), []);

  return {
    selected,
    isSelected: (id: number) => selectedSet.has(id),
    toggle,
    toggleAll,
    allSelected,
    clear,
    count: selected.length,
  };
}

export default useBulkSelection;
