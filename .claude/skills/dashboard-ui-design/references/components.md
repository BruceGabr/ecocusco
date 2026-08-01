# Componentes — EcoCusco

## Sidebar

- Logo/marca "EcoCusco" en la parte superior; la palabra "Cusco" en el acento mostaza.
- Ítem de navegación activo como **píldora sólida** en mostaza con texto sobre verde oscuro — no un tinte translúcido. El resto de ítems: ícono + label, sin fondo.
- Buen espaciado vertical entre ítems — nunca comprimidos.
- Footer del sidebar con tarjeta de usuario: avatar + nombre + rol, y el botón de cerrar sesión en estilo texto/outline discreto.
- Fondo `--green-900`. Sin líneas divisorias duras: separar logo, nav y footer con espaciado.

En móvil (`max-width:768px`) el sidebar colapsa a una barra horizontal scrolleable de íconos.

## Login / Autenticación

Patrón split-screen:

- **Panel izquierdo**: gradiente de marca dentro de la familia verde (`--green-900` → `--green-700`), con un halo radial mostaza muy sutil. Nunca un gradiente que salte de familia. Se oculta por completo en pantallas angostas.
- **Panel derecho**: fondo neutro, saludo + subtítulo, tabs de login/registro, inputs con label, y **un único botón de acción** en el acento sólido mostaza.
- El botón principal del login es el único elemento con acento sólido de la pantalla.

## Listados (tablas)

- **Tabla como patrón por defecto** para cualquier colección: zonas, horarios, camiones, reportes, usuarios, recolecciones.
- La tabla vive dentro de una tarjeta flotante (sombra, sin borde). El `thead` se distingue con `--sage-50` y tipografía pequeña en mayúsculas, no con bordes.
- Filas separadas por `--hairline` (separador interno, permitido), con hover en `--sage-50`.
- Columna de estado con badge limitado a los colores semánticos (`--state-*`). Nunca mostaza en un badge de estado: el mostaza significa acción, no estado.
- Fila de acciones al final, con íconos o menú — sin saturar de botones visibles por fila.
- **Toggle opcional tabla ⇄ cards** en la cabecera del listado para colecciones pequeñas. Misma fuente de datos, dos vistas — no dos componentes.

### Paginación

- Componente **flotante y compacto**, en su propia tarjeta con sombra y espaciado (`gap`) respecto de la tabla — nunca pegado al borde ni separado solo por una línea.
- Alineación **centrada o a la izquierda** (no a la derecha).
- Página actual en acento sólido; el resto en texto/outline.

### Barra de filtros / búsqueda

- Mismo tratamiento que la paginación: **bloque flotante independiente**, por encima de la tabla y separado por espaciado.
- Buscador con ícono de lupa a la izquierda, fondo neutro, sin borde grueso.
- Botones de filtro en **outline**; el filtro activo se marca con fondo suave (`--sage-100`) y texto oscuro, no con acento sólido.
- Acción principal (ej. "Nueva zona") en el **acento sólido**, alineada a la derecha — único elemento con acento de la barra.

## Wizard multi-paso (formularios largos)

Patrón split panel:

- **Panel izquierdo**: lista de pasos conectados por una línea vertical fina.
  - Paso activo: círculo sólido en mostaza + texto en negrita.
  - Pasos pendientes: círculo con número en gris, texto en gris.
  - Pasos completados: círculo con check en el **verde semántico** (`--state-success`) — coherente con el resto del sistema.
  - El indicador es agnóstico a la cantidad de pasos: se genera dinámicamente de la lista.
- **Panel derecho**: el formulario del paso actual, en la misma tarjeta flotante.
  - Campos agrupados por sección, cada sección con label pequeño gris en mayúsculas.
  - Grid de 2–3 columnas para campos relacionados.
  - Botón de avance en acento sólido a la derecha; "Atrás" en outline o texto.

## Ficha de detalle

### Header

- Avatar/ícono a la izquierda.
- Nombre en el tamaño de texto más grande de la ficha.
- Subtítulo debajo, chico y en gris.
- Badge(s) de estado junto al nombre, con los colores semánticos.
- Acción principal en acento sólido + secundarias en outline o ícono, a la derecha.
- Fila de datos rápidos como mini-bloques **sin borde individual** — separadores internos livianos o elevación por sombra.

### Navegación interna

- Tabs para las secciones principales de la ficha.

### Subsecciones

- Cada subsección como **tarjeta flotante independiente**, con espaciado entre ellas.
- Título simple, sin caja de ícono ni descripción redundante debajo.
- Campos en grid de 2–3 columnas: label pequeño gris arriba, valor abajo con más peso visual.
- Para listas internas (reportes de una zona, mantenimientos de un camión): lista compacta con badge de estado semántico.
