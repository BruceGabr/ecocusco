import React, { useEffect, useRef } from "react";

/**
 * Ventana superpuesta para formularios de creación y edición.
 *
 * Los paneles de administración mostraban el formulario siempre visible sobre
 * el listado; ahora la lista es lo único permanente y el formulario aparece
 * bajo demanda, sin ocupar toda la pantalla.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    // Se bloquea el scroll del fondo mientras el diálogo está abierto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // El primer campo recibe el foco al abrir.
    const first = dialogRef.current?.querySelector<HTMLElement>(
      "input, textarea, [role='combobox'], button:not(.modal-close)"
    );
    first?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={dialogRef}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
