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
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => React.Key;
  caption?: string;
  emptyMessage?: string;
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
              {columns.map(column => (
                <th key={column.key} style={{ textAlign: column.align ?? "left", width: column.width }} scope="col">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey(row, index)}>
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
