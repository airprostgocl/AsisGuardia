# GuardiaFlow — entregables

## Dashboard operativo y filtros
- [x] Mostrar indicadores de guardias en turno, presentes, ausentes y vacaciones.
- [x] Filtrar por mes, año, puesto/sucursal y búsqueda por nombre o RUT.
- [x] Interfaz en español, adaptable a escritorio, tablet y móvil.

## Marcación rápida de asistencia
- [x] En móvil, mostrar tarjetas individuales con botones grandes de Presente, Licencia, Vacaciones y Permiso.
- [x] En computador, mostrar cuadrícula mensual con guardias en filas y días en columnas.
- [x] Al tocar una celda, abrir un selector visual de estados con iconos y colores.
- [x] Confirmar cambios con feedback inmediato sin recargar.

## Cálculos y alertas
- [x] Calcular incidencia mensual como conteo de código multiplicado por factor de deducción.
- [x] Mostrar saldo inicial, consumido y restante de vacaciones con semáforo verde/amarillo/rojo.
- [x] Mostrar alertas para saldos en cero o negativos.
- [x] Preparar resumen anual por guardia.

## Gestión y continuidad
- [x] Incluir datos de demostración editables para validar la experiencia.
- [x] Conectar marcaciones y guardias a tablas gestionadas en base de datos (Supabase).
- [x] Generar reportes en PDF y Excel desde datos persistidos.
- [ ] Compartir el reporte por WhatsApp / correo directamente desde la app.

## Pendientes acordados (noviembre 2026)
Modelo de uso: se entrega la URL a la empresa de seguridad y su **supervisor administrador** gestiona
supervisores, empresas y guardias desde el panel de administración.

- [ ] **Feriados de Chile** (punto 3 del análisis): precargar feriados (incluidos irrenunciables), mostrarlos
      en la tabla y descontarlos del cálculo de vacaciones. Definir reglas antes de implementar.
- [ ] **Planificación de turnos** (punto 5 del análisis): turnos 4×4, 7×7, 5×2, 12 h; calendario de quién debe
      estar en cada puesto y alerta de puesto sin cubrir. Definir reglas antes de implementar.
- [ ] **Unir todo a `main`** (hoy en la rama `claude/busy-dirac-f169b6`) y cambiar el VPS a `main`.
- [ ] **Activar respaldos** de la base de datos Supabase (definir método y frecuencia).
