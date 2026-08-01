# Anti-patrones — qué evitar

Checklist a revisar antes de dar por terminada cualquier pantalla de EcoCusco:

- [ ] **¿Hay un "card header" con caja de ícono + título + descripción gris debajo?** Es el patrón por defecto de componentes tipo shadcn/ui sin personalizar. Usar solo un título simple, sin caja de ícono ni descripción redundante.
- [ ] **¿Cada tarjeta o bloque tiene su propio borde gris?** Reemplazar por sombra sutil + espaciado entre bloques. El exceso de bordes genera fatiga visual y aplana el diseño — nada flota, todo se ve contenido en cajas.
- [ ] **¿Hay varias mini-tarjetas de estadística (ícono + label + valor) idénticas y repetidas sin jerarquía entre ellas?** Es el "stat card" genérico por defecto. Integrarlas en un solo contenedor con separadores livianos, o diferenciar visualmente la más importante.
- [ ] **¿Algún badge o tag usa un color fuera del sistema semántico** (verde-estado / rojo / naranja / gris)? Si no representa un estado real, debe ir en badge neutro.
- [ ] **¿Aparece azul en algún lado?** El azul no pertenece a la gama de EcoCusco. Suele colarse como `--info` o como tag "informativo". Reemplazar por neutro.
- [ ] **¿Se usó el mostaza en un badge de estado?** El mostaza es el acento de acción. Un badge "Pendiente" va en `--state-pending` (naranja), nunca en mostaza — si no, "pendiente" y "acción principal" compiten por el mismo significado visual.
- [ ] **¿Se usó el verde de marca (`--green-500`) como color de éxito?** Debe usarse `--state-success`, que es más brillante y frío, para distinguir marca de estado.
- [ ] **¿Los degradados saltan entre familias distintas** (ej. verde a azul)? Deben quedarse dentro de la misma gama, variando solo tono o luminosidad.
- [ ] **¿La paginación o la barra de filtros está pegada al listado**, separada solo por una línea? Deben ser bloques flotantes independientes con su propio espaciado y sombra.
- [ ] **¿Se usó más de un color de acento sólido en la misma vista?** Un solo acento por vista, reservado para la acción principal — el resto en outline o texto.
- [ ] **¿Conviven varios radios de esquina distintos?** El sistema tiene un solo `--radius`; las píldoras solo para badges y chips.
- [ ] **¿Un listado se maquetó como lista de items cuando debería ser tabla?** La tabla es el patrón por defecto para colecciones de datos.

Si al revisar una pantalla terminada varias respuestas son "sí", es señal de que se cayó en el patrón genérico por defecto en vez de aplicar el sistema definido en esta skill.
