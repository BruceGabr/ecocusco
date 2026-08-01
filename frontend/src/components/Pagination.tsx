import React from "react";

/**
 * Paginación flotante y compacta, alineada a la izquierda,
 * separada de la tabla por espaciado propio (nunca pegada ni con línea).
 */
export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total?: number;
  onChange: (next: number) => void;
}) {
  if (pageCount <= 1) return null;

  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 1, pageCount - 2));
  const to = Math.min(pageCount, from + 2);
  for (let index = from; index <= to; index += 1) pages.push(index);

  return (
    <nav className="pagination" aria-label="Paginación">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">‹</button>
      {from > 1 && (
        <>
          <button type="button" onClick={() => onChange(1)}>1</button>
          {from > 2 && <span className="pagination-info">…</span>}
        </>
      )}
      {pages.map(item => (
        <button
          key={item}
          type="button"
          className={item === page ? "active" : ""}
          aria-current={item === page ? "page" : undefined}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
      {to < pageCount && (
        <>
          {to < pageCount - 1 && <span className="pagination-info">…</span>}
          <button type="button" onClick={() => onChange(pageCount)}>{pageCount}</button>
        </>
      )}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Página siguiente">›</button>
      {typeof total === "number" && <span className="pagination-info">{total} registros</span>}
    </nav>
  );
}

/** Divide una colección en la página activa. */
export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export default Pagination;
