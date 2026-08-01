import React from "react";

/**
 * Tonos admitidos = los 4 colores semánticos del sistema.
 * "blue" se conserva como alias legacy y cae a neutro: el azul no
 * pertenece a la gama (ver anti-patterns.md).
 */
export type ItemTone = "green" | "yellow" | "red" | "neutral" | "blue" | "";

const labelMap: Record<string, string> = {
  red: "Crítico",
  yellow: "Pendiente",
  green: "En regla",
  neutral: "Informativo",
  blue: "Informativo",
};

const toneClass: Record<string, string> = {
  red: "red",
  yellow: "yellow",
  green: "green",
  neutral: "neutral",
  blue: "neutral",
};

export function Item({ title, detail, color = "", badge }: { title: string; detail: string; color?: ItemTone; badge?: string }) {
  const label = badge ?? (color ? labelMap[color] ?? color : "");
  return (
    <article className="item">
      <div className="item-row">
        <strong>{title}</strong>
        {color && <span className={`tag ${toneClass[color] ?? "neutral"}`}>{label}</span>}
      </div>
      <span>{detail}</span>
    </article>
  );
}

export default Item;
