import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

const MINUTE_STEP = 5;
const HOURS_12 = Array.from({ length: 12 }, (_, index) => index + 1);
const PERIODS = ["AM", "PM"] as const;
type Period = typeof PERIODS[number];

/** "HH:MM" (24h) → partes en formato de 12 horas. */
function parse24(value: string): { hour12: number; minute: number; period: Period } {
  const [rawHour, rawMinute] = (value ?? "").split(":");
  const hour24 = Number.isFinite(Number(rawHour)) ? Math.min(23, Math.max(0, Number(rawHour))) : 8;
  const minute = Number.isFinite(Number(rawMinute)) ? Math.min(59, Math.max(0, Number(rawMinute))) : 0;
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

/** Partes en 12 horas → "HH:MM" (24h), que es lo que persiste el backend. */
function format24(hour12: number, minute: number, period: Period): string {
  const hour24 = period === "AM" ? (hour12 === 12 ? 0 : hour12) : (hour12 === 12 ? 12 : hour12 + 12);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Etiqueta legible en 12 horas. */
export function formatTimeLabel(value: string): string {
  const { hour12, minute, period } = parse24(value);
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * Selector de hora propio en formato de 12 horas.
 *
 * El `input[type="time"]` delega su reloj al navegador, que lo pinta con la
 * paleta del sistema (el azul ajeno al diseño) y en el formato del idioma del
 * equipo. Este componente mantiene el valor en "HH:MM" de 24 horas —lo que
 * espera el backend— y solo la presentación es de 12 horas.
 */
export function TimePicker({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const parts = useMemo(() => parse24(value), [value]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Se incluye el minuto actual aunque no sea múltiplo del paso, para no
  // perder valores que ya existan en los datos.
  const minutes = useMemo(() => {
    const base = Array.from({ length: Math.ceil(60 / MINUTE_STEP) }, (_, index) => index * MINUTE_STEP);
    return base.includes(parts.minute) ? base : [...base, parts.minute].sort((a, b) => a - b);
  }, [parts.minute]);

  function apply(next: Partial<{ hour12: number; minute: number; period: Period }>) {
    const merged = { ...parts, ...next };
    onChange(format24(merged.hour12, merged.minute, merged.period));
  }

  return (
    <div className="timepicker" ref={wrapRef}>
      <button
        type="button"
        id={id}
        className="select-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
      >
        <span className="select-value">{formatTimeLabel(value)}</span>
        <span className="timepicker-icon" aria-hidden="true"><Icon name="schedules" size={15} /></span>
      </button>

      {open && (
        <div className="timepicker-panel" role="dialog" aria-label="Seleccionar hora">
          <div className="timepicker-columns">
            <ul className="timepicker-column" aria-label="Hora">
              {HOURS_12.map(hour => (
                <li key={hour}>
                  <button
                    type="button"
                    className={`timepicker-cell${hour === parts.hour12 ? " active" : ""}`}
                    aria-pressed={hour === parts.hour12}
                    onMouseDown={event => event.preventDefault()}
                    onClick={event => { event.preventDefault(); apply({ hour12: hour }); }}
                  >
                    {hour}
                  </button>
                </li>
              ))}
            </ul>

            <span className="timepicker-separator" aria-hidden="true">:</span>

            <ul className="timepicker-column" aria-label="Minutos">
              {minutes.map(minute => (
                <li key={minute}>
                  <button
                    type="button"
                    className={`timepicker-cell${minute === parts.minute ? " active" : ""}`}
                    aria-pressed={minute === parts.minute}
                    onMouseDown={event => event.preventDefault()}
                    onClick={event => { event.preventDefault(); apply({ minute }); }}
                  >
                    {String(minute).padStart(2, "0")}
                  </button>
                </li>
              ))}
            </ul>

            <ul className="timepicker-column periods" aria-label="AM o PM">
              {PERIODS.map(period => (
                <li key={period}>
                  <button
                    type="button"
                    className={`timepicker-cell${period === parts.period ? " active" : ""}`}
                    aria-pressed={period === parts.period}
                    onMouseDown={event => event.preventDefault()}
                    onClick={event => { event.preventDefault(); apply({ period }); }}
                  >
                    {period}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="timepicker-foot">
            <span className="timepicker-preview">{formatTimeLabel(value)}</span>
            <button type="button" className="btn sm primary" onMouseDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); close(); }}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimePicker;
