# GuardiaFlow — plan de implementación

## Alcance
Panel web en español para supervisores de vigilancia. La plantilla Excel se traduce a: matriz diaria, catálogo visual de estados, factores ponderados, saldos de vacaciones y resumen anual.

## Diseño
- **Movimiento:** dashboard operativo tipo control room, sobrio y humano.
- **Principios:** acción rápida, jerarquía clara, estados reconocibles por color + icono, densidad útil sin aspecto de planilla.
- **Paleta:** navy profundo para estructura, marfil cálido para fondo, verde menta para presente, azul cielo para vacaciones, naranja para permisos/medios días, rojo coral para licencias y violeta para compensatorios.
- **Layout:** navegación lateral compacta y contenido en dos capas: pulso del día arriba, control mensual abajo. En móvil se convierte en tarjetas de guardias con botones de un toque.
- **Firma visual:** banda vertical colorida en cada tarjeta, chips de estado, números grandes y barra de vacaciones.
- **Interacción:** tocar una celda abre una paleta de estados; elegir estado confirma al instante con toast; filtros son siempre visibles.
- **Animación:** transiciones de 160–220ms, feedback de escala en acciones táctiles, sin animaciones decorativas.
- **Tipografía:** Inter/system sans, títulos fuertes y etiquetas compactas.
- **Esencia:** el control diario de un supervisor, convertido en decisiones de dos toques. Claro, ágil, confiable.
- **Voz:** directa y tranquilizadora. “Marca el estado y sigue con tu ronda.” “La cobertura de hoy está bajo control.”
- **Marca:** monograma GF en un escudo redondeado, con una línea que evoca una ronda.
- **Color propio:** verde petróleo #0E6B5B.

## Estructura
- `client/src/pages/Home.tsx`: dashboard, filtros, matriz y vista móvil.
- `client/src/index.css`: tokens visuales, responsive y componentes del panel.
- `drizzle/schema.ts`: usuarios y entidades futuras de guardias, tipos y registros.
- `server/db.ts` / `server/routers.ts`: punto de extensión para persistencia y consultas.
- `public/manus-routes.json`: manifest de rutas.

## Decisiones funcionales
Los datos demo permiten validar UX sin carga inicial. La fórmula de la plantilla se conserva como `conteo × factor`; vacaciones descuenta solo estados con factor 1.0. En la siguiente iteración se conectan los mismos tipos a las tablas gestionadas.
