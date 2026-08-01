import React, { useId } from "react";
import { Icon } from "./Icon";
import { Select, SelectOption } from "./Select";

/**
 * Filtro desplegable de la barra de herramientas.
 *
 * Sustituye a las barras de búsqueda de texto libre, que en catálogos cerrados
 * (zonas, días, conductores) no aportaban nada: se escribía a ciegas y no había
 * forma de saber qué valores existían.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "Todos",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  allLabel?: string;
}) {
  const id = useId();
  return (
    <div className="filter-select">
      <label htmlFor={id}>{label}</label>
      <Select id={id} value={value} onChange={onChange} options={[{ value: "", label: allLabel }, ...options]} />
    </div>
  );
}

/**
 * Barra de filtros/búsqueda como bloque flotante independiente,
 * separada del listado por espaciado propio — nunca pegada a la tabla.
 *
 * `action` es el único elemento que lleva el acento sólido.
 */
export function Toolbar({
  search,
  onSearch,
  searchPlaceholder = "Buscar...",
  searchLabel,
  filters,
  action,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  filters?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="toolbar">
      {onSearch && (
        <div className="toolbar-search">
          <Icon name="search" />
          <input
            type="text"
            value={search ?? ""}
            placeholder={searchPlaceholder}
            aria-label={searchLabel ?? searchPlaceholder}
            onChange={event => onSearch(event.target.value)}
          />
        </div>
      )}
      {filters && <div className="toolbar-filters">{filters}</div>}
      {action && (
        <>
          <span className="toolbar-spacer" />
          {action}
        </>
      )}
    </div>
  );
}

/** Grupo de botones de filtro en outline; el activo va en fondo suave, no en acento. */
export function FilterGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) {
  return (
    <div className="filter-bar" role="group" aria-label={label}>
      {options.map(option => (
        <button
          key={option}
          type="button"
          className={`filter-btn ${value === option ? "active" : ""}`}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default Toolbar;
