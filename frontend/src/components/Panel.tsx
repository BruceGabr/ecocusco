import React from "react";

type PanelProps = {
  /** Aceptado por compatibilidad, pero no se renderiza: el sistema de diseño
   *  pide título simple, sin caja de ícono (ver anti-patterns.md). */
  icon?: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Panel({ title, actions, className = "", children }: PanelProps) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      {title && (
        <div className="panel-header">
          <h2>{title}</h2>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export default Panel;
