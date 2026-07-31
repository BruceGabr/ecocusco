import React from "react";

type PanelProps = {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Panel({ icon, title, actions, className = "", children }: PanelProps) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      {title && (
        <div className="panel-header">
          <h2>{icon}{title}</h2>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export default Panel;
