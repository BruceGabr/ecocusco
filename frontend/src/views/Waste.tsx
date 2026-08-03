import React from 'react';
import { Icon, IconName } from '../components/Icon';

type WasteType = {
  name: string;
  desc: string;
  bin: string;
  icon: IconName;
  color: string;
};

const wasteTypes: WasteType[] = [
  {
    name: 'Orgánicos',
    desc: 'Restos de comida, cáscaras, hojas y residuos biodegradables.',
    bin: 'Verde',
    icon: 'leaf',
    color: 'green',
  },
  {
    name: 'Plástico',
    desc: 'Botellas, envases y bolsas de plástico limpio.',
    bin: 'Azul',
    icon: 'plastic',
    color: 'blue',
  },
  {
    name: 'Vidrio',
    desc: 'Botellas y frascos de vidrio.',
    bin: 'Amarillo',
    icon: 'glass',
    color: 'yellow',
  },
  {
    name: 'Papel',
    desc: 'Papel, cartón y periódicos.',
    bin: 'Blanco',
    icon: 'paper',
    color: 'white',
  },
  {
    name: 'No reciclables',
    desc: 'Tecnopor contaminado, colillas y residuos sanitarios.',
    bin: 'Gris',
    icon: 'trash',
    color: 'sage',
  },
];

export function Waste() {
  return (
    <div className='waste-grid'>
      {wasteTypes.map((w) => (
        <div className='waste-card' key={w.name}>
          <div className={`waste-icon ${w.color}`}>
            <Icon name={w.icon} />
          </div>
          <h3>{w.name}</h3>
          <p>{w.desc}</p>
          <span className='bin-label'>Contenedor {w.bin}</span>
        </div>
      ))}
    </div>
  );
}

export default Waste;
