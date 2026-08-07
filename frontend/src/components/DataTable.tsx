import React from "react";
import { EmptyState } from "./EmptyState";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
};

/**
 * Selección múltiple opcional. Cuando se pasa, la tabla antepone una columna
 * de casillas y la cabecera lleva la de "seleccionar todo".
 */
export type TableSelection<T> = {
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  allSelected: boolean;
  onToggleAll: () => void;
  /** Texto accesible de cada casilla: "Seleccionar zona Wanchaq". */
  labelOf: (row: T) => string;
  /** Filas que no se pueden seleccionar (p. ej. sin id todavía). */
  isDisabled?: (row: T) => boolean;
};

/**
 * Tabla como patrón por defecto de cualquier listado.
 * Vive en una tarjeta flotante (sombra, sin borde); las filas se separan
 * con hairline interno, que es el único uso permitido de línea.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage = "No hay registros que coincidan con tu búsqueda",
  selection,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => React.Key;
  caption?: string;
  emptyMessage?: string;
  selection?: TableSelection<T>;
}) {
  if (rows.length === 0) {
    return (
      <div className="table-card" style={{ padding: 16 }}>
        <EmptyState message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="table-wrapper">
        <table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {selection && (
                <th scope="col" className="select-cell">
                  <input
                    type="checkbox"
                    checked={selection.allSelected}
                    onChange={selection.onToggleAll}
                    aria-label="Seleccionar todas las filas visibles"
                  />
                </th>
              )}
              {columns.map(column => (
                <th key={column.key} style={{ textAlign: column.align ?? "left", width: column.width }} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey(row, index)} className={selection?.isSelected(row) ? "row-selected" : undefined}>
                {selection && (
                  <td className="select-cell">
                    <input
                      type="checkbox"
                      checked={selection.isSelected(row)}
                      disabled={selection.isDisabled?.(row) ?? false}
                      onChange={() => selection.onToggle(row)}
                      aria-label={selection.labelOf(row)}
                    />
                  </td>
                )}
                {columns.map(column => (
                  <td key={column.key} style={{ textAlign: column.align ?? "left" }}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
