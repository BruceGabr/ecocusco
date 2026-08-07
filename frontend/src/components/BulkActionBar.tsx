import React from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * Barra que aparece sobre el listado cuando hay filas seleccionadas.
 *
 * Solo se muestra con selección activa: en reposo el listado no cambia de
 * altura ni compite con la barra de filtros.
 */
export function BulkActionBar({
  count,
  noun,
  onDelete,
  onClear,
  busy = false,
}: {
  count: number;
  /**
   * Nombre del recurso en singular y plural. Se piden los dos porque el
   * español no los deriva de forma fiable: el plural de "camión" es "camiones",
   * no "camións", y quitar la -s final daría "camione".
   */
  noun: { singular: string; plural: string };
  onDelete: () => void;
  onClear: () => void;
  busy?: boolean;
}) {
  if (count === 0) return null;

  return (
    <div className="bulk-bar" role="region" aria-label="Acciones sobre la selección">
      <span className="bulk-count">
        {/* "en la selección" evita concordar el participio con el género del
            recurso ("zonas seleccionadas" frente a "camiones seleccionados"). */}
        {count === 1 ? `1 ${noun.singular} en la selección` : `${count} ${noun.plural} en la selección`}
      </span>
      <span className="toolbar-spacer" />
      <Button size="sm" onClick={onClear} disabled={busy}>Cancelar selección</Button>
      <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}>
        <Icon name="trash" size={15} /> {busy ? "Eliminando..." : "Eliminar seleccionados"}
      </Button>
    </div>
  );
}

export default BulkActionBar;
