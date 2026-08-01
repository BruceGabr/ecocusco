# Tokens de diseño — EcoCusco

## Color

### Regla base

Una interfaz = **1 gama de color base** con variantes tonales sutiles + **1 acento**. Las variantes se generan ajustando **luminosidad o saturación dentro de la misma familia** — nunca mezclando familias distintas.

En EcoCusco la gama base es el **verde oscuro grisáceo**, expresado en dos escalas de la misma familia:

- `--green-*` — los tonos saturados (marca, sidebar, superficies oscuras).
- `--sage-*` — las variantes desaturadas/grisáceas de ese mismo verde (fondos sutiles, bordes, texto muted, hovers).

No son dos colores: `sage` es `green` con la saturación bajada. Por eso conviven sin romper la regla de una sola gama.

### Paleta activa

```css
/* Base — verde oscuro (tonos saturados) */
--green-900: #0a1f14;  /* sidebar, superficies más oscuras */
--green-800: #0f2a1a;
--green-700: #1a3a2a;
--green-600: #234d36;
--green-500: #2d5a3d;  /* verde de marca */
--green-400: #3a7a4a;
--green-300: #5a9a6a;
--green-200: #8aba9a;
--green-100: #c0d8c8;

/* Base — gris verdoso (misma familia, desaturada) */
--sage-700: #3a4a42;
--sage-600: #4a5a52;
--sage-500: #5a7a6a;
--sage-400: #7a9a8a;
--sage-300: #9ab0a5;
--sage-200: #c0d0c5;
--sage-100: #e0e8e3;
--sage-50:  #f0f5f2;

/* Acento único — mostaza */
--mustard-700: #8a6a10;  /* pressed */
--mustard-600: #a08020;
--mustard-500: #c49a30;  /* acento base */
--mustard-400: #d4a843;  /* hover / sobre fondo oscuro */
--mustard-300: #e0b850;
--mustard-200: #e8c870;
--mustard-100: #f0d8a0;
--mustard-50:  #faf0d8;

--accent:        var(--mustard-500);
--accent-hover:  var(--mustard-600);
--accent-soft:   var(--mustard-50);
```

### Escala de uso

| Paso | Uso típico |
|------|------------|
| 50 / 100 | Tintes muy claros — fondos sutiles, estados hover |
| 300 / 400 | Tono medio-claro — iconos secundarios, texto sobre fondo oscuro |
| 500 | Tono base / acento principal |
| 700 / 800 | Tono oscuro — texto sobre fondo claro, estados "pressed" |
| 900 | El más oscuro — sidebar, uso puntual |

### Colores semánticos de estado (fijos, no configurables)

- **Verde de estado** — activo / resuelto / éxito
- **Rojo** — inactivo / rechazado / error
- **Naranja** — pendiente / advertencia
- **Gris** — neutro (sin asignar, no aplica)

```css
--state-success:    #1a8a4e;  --state-success-bg: #dcf3e4;
--state-danger:     #b53a3a;  --state-danger-bg:  #f8d8d8;
--state-pending:    #c2610f;  --state-pending-bg: #fbe8d5;
--state-neutral:    #5a6a62;  --state-neutral-bg: #e8ece9;
```

> **Nota crítica para EcoCusco — doble colisión.**
> La marca es verde y el acento es mostaza, así que los dos colores semánticos que naturalmente chocarían se desplazan a propósito:
>
> - El **verde de estado** (`#1a8a4e`) es más brillante y frío que el **verde de marca** (`#2d5a3d`), para que un badge "Resuelto" no se lea como cromo de marca.
> - El **naranja de pendiente** (`#c2610f`) se aleja del amarillo hacia el naranja, para que no se confunda con el **mostaza de acento** (`#c49a30`), que significa "acción principal", no "advertencia".
>
> Si en el futuro se cambia la marca o el acento, revisar estos dos valores primero.

**Nada de azul.** No pertenece a la gama. Cualquier tag informativo que no represente estado va en `--state-neutral`.

### Funcionales

```css
--bg:          #f2efe8;   /* fondo hueso de la app */
--panel:       #ffffff;   /* superficie de tarjeta */
--panel-alt:   #f8f6f0;   /* superficie anidada */
--ink:         #1a1a1a;
--muted:       #5a6a62;
--muted-light: #8a9a92;
--hairline:    #e8e5dc;   /* SOLO separadores internos, nunca contorno de bloque */
```

`--hairline` existe únicamente para separar grupos de campos *dentro* de una tarjeta. No se usa como borde de tarjeta.

## Tipografía — jerarquía

1. **Título principal** (encabezado de página) — el tamaño más grande, semibold/bold
2. **Subtítulo / descripción** — tamaño medio, color muted
3. **Título de subsección** (dentro de tarjetas) — medio, semibold, color base
4. **Label de campo** — pequeño, muted, opcionalmente mayúsculas con tracking sutil
5. **Valor de campo** — regular o medium, color base, con más peso visual que el label

Regla general: el dato importante siempre pesa más (tamaño/color) que su etiqueta.

## Espaciado y forma

```css
--radius:      14px;   /* ÚNICO radio del sistema */
--radius-pill: 999px;  /* solo badges y chips */

--shadow-sm: 0 1px 2px rgba(10,31,20,0.06);
--shadow-md: 0 4px 12px rgba(10,31,20,0.08);
--shadow-lg: 0 8px 24px rgba(10,31,20,0.10);
```

- Tarjetas y bloques con **sombra sutil, no borde**.
- Un único radio respetado en botones, inputs, tarjetas y modales por igual.
- Separación entre bloques mediante **espaciado (gap)**, no líneas divisorias.
- Si hace falta delimitar algo, usar sombra + fondo ligeramente distinto en vez de un borde.

## Modo oscuro

El sistema soporta `html[data-theme="dark"]`. En oscuro se invierten las superficies (`--bg`, `--panel`, `--ink`, `--muted`), se oscurecen los fondos de estado, y las sombras pasan a negro con más opacidad. El acento mostaza y los colores semánticos **no cambian de matiz** — solo sus fondos suaves.

## Efecto "glass" (uso puntual)

Para menús flotantes, dropdowns y modales: fondo semitransparente + `backdrop-filter: blur(...)`. Reservado para elementos flotantes temporales. No usar como tratamiento por defecto del layout base.
