import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

/**
 * Select con lista propia.
 *
 * El `<select>` nativo delega la lista desplegable al sistema operativo, que
 * CSS no alcanza: de ahí el resaltado azul y la tipografía ajenas al sistema de
 * diseño. Este componente implementa el patrón combobox/listbox de ARIA para
 * poder estilar la lista y mantener el teclado y el lector de pantalla.
 *
 * El disparador es un <button>, que es un elemento etiquetable: un
 * `<label htmlFor={id}>` le da nombre accesible igual que a un select nativo.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Selecciona una opción",
  disabled = false,
  invalid = false,
  ariaLabel,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  describedBy?: string;
}) {
  const generatedId = useId();
  const listId = `${id ?? generatedId}-listbox`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selectedIndex = useMemo(() => options.findIndex(option => option.value === value), [options, value]);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback(() => setOpen(false), []);

  const commit = useCallback((index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  }, [options, onChange]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
    // jsdom (y otros entornos sin layout) no implementan scrollIntoView.
    if (typeof active?.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) { setOpen(true); return; }
        setActiveIndex(index => Math.min(index + 1, options.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!open) { setOpen(true); return; }
        setActiveIndex(index => Math.max(index - 1, 0));
        return;
      case "Home":
        if (open) { event.preventDefault(); setActiveIndex(0); }
        return;
      case "End":
        if (open) { event.preventDefault(); setActiveIndex(options.length - 1); }
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) commit(activeIndex); else setOpen(true);
        return;
      case "Escape":
        if (open) { event.preventDefault(); close(); }
        return;
      case "Tab":
        close();
        return;
      default:
        return;
    }
  }

  return (
    <div className="select" ref={wrapRef}>
      <button
        type="button"
        id={id}
        role="combobox"
        className={`select-trigger${invalid ? " invalid" : ""}`}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "select-value" : "select-value placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="select-list" id={listId} role="listbox" ref={listRef} tabIndex={-1}>
          {options.length === 0 && <li className="select-empty">Sin opciones disponibles</li>}
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`select-option${index === activeIndex ? " active" : ""}${option.value === value ? " selected" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              // preventDefault es imprescindible: cuando un <label> envuelve al
              // Select (los paneles de administración lo hacen), el clic sobre
              // la opción se reenvía al control etiquetado —el disparador— y la
              // lista se reabría justo después de que commit() la cerrara.
              onMouseDown={event => event.preventDefault()}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                commit(index);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Select;
