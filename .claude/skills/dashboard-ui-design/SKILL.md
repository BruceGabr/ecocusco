---
name: dashboard-ui-design
description: Sistema de diseño para las interfaces de EcoCusco (login, sidebar, dashboard, listados con tabla, paginación, barra de filtros/búsqueda, wizards multi-paso y fichas de detalle). Úsala SIEMPRE que se pida construir, maquetar o mejorar cualquier pantalla del panel administrativo u operativo — dashboard, listados de zonas/horarios/camiones/reportes/usuarios, formularios multi-paso o fichas de detalle — incluso si el usuario no menciona explícitamente la palabra "skill" o "diseño". La paleta activa es verde oscuro grisáceo + acento mostaza; consulta references/tokens.md para valores de color, tipografía y espaciado, references/components.md para patrones de componentes, y references/anti-patterns.md antes de entregar cualquier UI.
---

# Dashboard UI Design — Sistema de diseño EcoCusco

Guía para construir las interfaces de EcoCusco (sidebar, dashboard, listados, fichas de detalle) con un lenguaje visual consistente: minimalista, elegante y con presencia, sin volverse extravagante ni disperso en colores.

## Filosofía

- **Una gama + un acento.** Toda la interfaz se construye sobre la familia verde oscuro grisáceo (con variantes tonales sutiles) más el mostaza reservado para acciones y estados importantes. Nunca conviven varios colores decorativos sin motivo funcional.
- **Todo flota.** Las tarjetas y bloques se separan del fondo con sombra sutil y espaciado, no con bordes ni líneas divisorias. Es el detalle que más diferencia una interfaz cuidada de una genérica.
- **El color con propósito.** Fuera de la paleta de marca, el color solo se usa para comunicar estado (activo/pendiente/error/neutro) o para señalar la acción principal de una vista — nunca de forma puramente decorativa.

## Paleta activa — EcoCusco

- **Base:** verde oscuro grisáceo (`--green-*` para los tonos saturados, `--sage-*` para las variantes desaturadas de la misma familia).
- **Acento único:** mostaza (`--accent`, `#c49a30`).
- **Neutro:** `#ffffff` sobre fondo hueso `#f2efe8`.

Los valores completos y la escala tonal están en `references/tokens.md`. Todos los componentes deben referenciar las variables CSS, nunca colores hardcodeados.

## Cómo usar esta skill

1. Confirma la paleta activa en `references/tokens.md` antes de construir cualquier componente.
2. Consulta `references/components.md` para el patrón específico: sidebar, login, tabla de listado, paginación, barra de filtros o ficha de detalle.
3. Antes de dar por terminada una pantalla, repasa el checklist de `references/anti-patterns.md`.

## Reglas no negociables

- **Estados = máximo 4 colores fijos:** verde de estado (activo/resuelto/éxito), rojo (inactivo/rechazado/error), naranja (pendiente/advertencia), gris (neutro). No se usan para nada más que representar estado.
- **El verde de estado NO es el verde de marca** y **el naranja de estado NO es el mostaza de acento.** EcoCusco tiene marca verde y acento mostaza, así que ambos colores semánticos se desplazan deliberadamente para que no se confunda "esto es la marca" con "esto significa activo/pendiente". Ver la nota en `tokens.md`.
- **Nada de azul.** No forma parte de la gama. Un tag informativo que no represente estado va en badge neutro.
- **Tags que no son estado** (ej. "Orgánico", "Zona 3") van en badge neutro (gris u outline), nunca con un color que pueda confundirse con un estado real.
- **Tabla como patrón por defecto** para cualquier listado (zonas, horarios, camiones, reportes, usuarios, recolecciones). Un toggle opcional tabla ⇄ cards cubre los casos de pocos registros — no se duplica como componente aparte.
- **Un solo acento sólido por vista**, reservado para la acción principal. El resto de botones van en outline o como texto/ícono.
- **Paginación y barra de filtros/búsqueda siempre flotantes**, separadas del contenido con su propio espaciado y sombra — nunca pegadas ni delimitadas solo por una línea.
- **Un único radio de esquina** (`--radius`) en botones, inputs, tarjetas y modales. Las píldoras (`--radius-pill`) se reservan para badges y chips.
- **Degradados solo dentro de la misma familia de color** (variar tono/luminosidad), nunca transiciones entre colores distintos.

## Estructura de esta skill

- `references/tokens.md` — paleta EcoCusco (base + acento + semánticos), tipografía, espaciado, radios, sombras, efecto glass.
- `references/components.md` — sidebar, login/autenticación, listados (tabla, paginación, filtros), wizard multi-paso, ficha de detalle.
- `references/anti-patterns.md` — checklist de errores típicos de UI genérica a evitar siempre.
