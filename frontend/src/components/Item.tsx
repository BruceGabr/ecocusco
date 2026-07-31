import React from "react";

const labelMap: Record<string, string> = {
  red: "Crítico",
  yellow: "Pendiente",
  blue: "Activo",
  green: "Completado",
};

export function Item({ title, detail, color = "" }: { title: string; detail: string; color?: string }) {
  return (
    <article className="item">
      <div className="item-row">
        <strong>{title}</strong>
        {color && <span className={`tag ${color}`}>{labelMap[color] || color}</span>}
      </div>
      <span>{detail}</span>
    </article>
  );
}

export default Item;
