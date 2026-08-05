# Revisión de accesibilidad y experiencia móvil

Fecha de revisión: 5 de agosto de 2026.

## Alcance

La revisión cubre el menú del cliente, el flujo de pedido, los diálogos de
promociones, el acceso de cocina, la cuenta y los paneles administrativos. El
objetivo de referencia es WCAG 2.2 nivel AA, con comprobaciones automáticas y
una lista manual reproducible.

## Correcciones implementadas

- El idioma del documento se declara como español de Colombia (`es-CO`).
- Todos los controles interactivos reciben un indicador de foco visible y de
  alto contraste.
- Los dispositivos táctiles reciben objetivos de al menos 44 píxeles de alto;
  los controles de cantidad son de 44 por 44 píxeles.
- Las preferencias de movimiento reducido desactivan animaciones y
  transiciones no esenciales.
- Los diálogos de promoción y pedido reciben nombre accesible, foco inicial,
  encierro de foco, cierre con `Escape`, restauración de foco y bloqueo del
  desplazamiento de fondo.
- Los campos de nombre, dirección y teléfono están vinculados a sus etiquetas
  y ofrecen sugerencias correctas de autocompletado.
- La cantidad de cada producto se anuncia a tecnologías de asistencia.
- El diálogo del pedido usa altura dinámica (`dvh`) y el documento evita el
  desbordamiento horizontal accidental.

## Cobertura automática

La prueba E2E del menú comprueba en una ventana de 360 por 740 píxeles:

1. idioma del documento;
2. foco inicial y cierre con teclado de ambos diálogos;
3. activación de un producto con `Enter`;
4. asociación de etiquetas del formulario;
5. ausencia de desbordamiento horizontal.

## Verificación manual antes de una entrega

- Recorrer `/menu`, `/cocina`, `/admin`, `/admin/usuarios` y `/cuenta` usando
  únicamente `Tab`, `Shift+Tab`, `Enter`, `Espacio` y `Escape`.
- Comprobar zoom al 200 % en 360, 768 y 1280 píxeles de ancho.
- Probar VoiceOver en Safari o NVDA en Firefox, verificando títulos, etiquetas,
  estados y anuncios de los diálogos.
- Confirmar contraste cuando cambien colores de marca o se incorporen nuevos
  componentes.
- Probar orientación vertical y horizontal en un dispositivo móvil real.

La revisión manual sigue siendo parte del smoke test de cada despliegue: una
interfaz puede cambiar sin que una prueba estructural detecte todos los
problemas perceptivos o de comprensión.
