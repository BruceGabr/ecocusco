import React from "react";
import { Icon, IconName } from "../components/Icon";

const wasteTypes: Array<{ name: string; desc: string; bin: string; icon: IconName; color: string }> = [
  { name: "Orgánicos", desc: "Restos de comida, cáscaras, hojas y residuos biodegradables.", bin: "Verde", icon: "leaf", color: "green" },
  { name: "Plástico", desc: "Botellas, envases y bolsas de plástico limpio.", bin: "Azul", icon: "recycle", color: "blue" },
  { name: "Vidrio", desc: "Botellas y frascos de vidrio.", bin: "Amarillo", icon: "recycle", color: "yellow" },
  { name: "Papel", desc: "Papel, cartón y periódicos.", bin: "Blanco", icon: "recycle", color: "white" },
  { name: "No reciclables", desc: "Tecnopor contaminado, colillas y residuos sanitarios.", bin: "Gris", icon: "trash", color: "sage" },
];

export function Waste() {
  return (
    <div className="waste-grid">
      {wasteTypes.map(w => (
        <div className="waste-card" key={w.name}>
          <div className={`waste-icon ${w.color}`}><Icon name={w.icon} /></div>
          <h3>{w.name}</h3>
          <p>{w.desc}</p>
          <span className="bin-label" style={{background:'var(--green-100)',color:'var(--green-600)'}}>{w.bin}</span>
        </div>
      ))}
    </div>
  );
}

export default Waste;
