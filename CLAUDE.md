# Memoria del proyecto GuardiaFlow (AsisGuardia)

## Estilo de trabajo con el usuario

- Responder en español, breve y conciso, salvo que pida más detalle.
- Antes de un trabajo complejo, hacer preguntas aclaratorias.
- El usuario ejecuta los comandos en su VPS: darle **un comando por bloque**, en orden, indicando dónde
  ejecutarlo (`/opt/guardiaflow`) y qué resultado esperar. Pedirle que pegue la salida si algo falla.
- Si un problema costó resolverse, proponer (preguntando antes) añadir aquí la solución.

### Regla: nombrar cada clave por su nombre exacto

Nunca decir solo "contraseña" o "clave": se presta a confusión. Usar siempre uno de estos nombres:

| Nombre | Qué es | Dónde se usa |
|---|---|---|
| **Contraseña de cuenta Supabase** | Login en supabase.com | No se usa en la app |
| **Contraseña de la base de datos Supabase** | Definida al crear el proyecto; no se puede volver a ver, solo restablecer (Database → Settings) | Dentro de `SUPABASE_POOLER_DATABASE_URL` |
| **SESSION_SECRET** | Generada con `openssl rand -hex 32` | `.env` |
| **Contraseña de cuenta Google** | Login de Gmail | No se usa en la app |
| **Contraseña de aplicación de Gmail** | 16 letras de myaccount.google.com/apppasswords (requiere verificación en 2 pasos) | `SMTP_PASS` en `.env` |
| **Contraseña del supervisor** | Login de GuardiaFlow | Pantalla de ingreso |
| **Contraseña temporal del supervisor** | La asigna el administrador; se cambia obligatoriamente al primer ingreso | Administrar supervisores |
| **Token de GitHub** | Reemplaza la contraseña en `git clone` de un repo privado | VPS |

## Despliegue (ver DEPLOY.md)

- VPS Hostinger con **Nginx instalado en el sistema** (no Traefik) sirviendo otros sitios y dos n8n.
  La app corre en Docker en `127.0.0.1:3010`; Nginx la publica y certbot pone el HTTPS.
- No tocar otros proyectos del VPS: nada de `docker system prune` ni `docker compose down` fuera de `/opt/guardiaflow`.
- Base de datos: Supabase vía **Session pooler (puerto 5432)**. No usar Transaction pooler (6543):
  postgres.js usa prepared statements. Direct connection es solo IPv6 y Docker no la alcanza.

### Orden obligatorio al actualizar con migraciones

`git pull` → `docker compose build` → `docker compose run --rm guardiaflow pnpm db:migrate` → `docker compose up -d --force-recreate`.

- La migración se ejecuta **dentro de la imagen**: si no se compila antes, corre el código viejo y no aplica nada.
- Si la app nueva arranca antes de migrar, el login falla (columnas inexistentes).
- Verificar con `psql` (imagen `postgres:16-alpine`) que las columnas nuevas existan.
- Cambios en `.env` requieren `docker compose up -d --force-recreate`.

## Código

- Lógica de cuentas: `server/supervisorAccounts.ts`; permisos en `server/_core/trpc.ts`
  (`supervisorAdminProcedure`, bloqueo por contraseña temporal pendiente).
- Las sesiones están ligadas a la huella de la contraseña: cambiarla invalida las sesiones anteriores.
- Nunca enviar `passwordHash` al navegador (usar `publicSupervisor`).
- Colores de causas: la UI usa la paleta de categorías (`causeCategory` en `Home.tsx`), no los colores
  de `absence_types` en la base de datos, para que coincidan con la leyenda.
- Al pedir cambios de diseño, el usuario exige **no tocar procesos** (datos, API, marcaciones).
- Avisos temporales (sonner, abajo a la derecha): siempre con fondo de color y texto blanco
  (`components/ui/sonner.tsx` + clases `gf-toast-*` en `index.css`); nunca fondo blanco o transparente.
- Alcance por supervisor: cada supervisor ve en los listados solo los guardias de las empresas/puntos
  marcados en «Mis empresas» (`myScope`/`inMyScope` en `Home.tsx`); el administrador ve todo. Es un filtro
  de vista: cualquier supervisor puede marcar cualquier empresa (así se hacen los reemplazos).
- Historial de marcaciones: `server/attendanceAudit.ts` y tabla `attendance_history`; solo el administrador
  lo consulta (`supervisors.markAuthors` / `markHistory`). El snapshot no envía `registeredBy` a supervisores.
- Listas de guardias (tabla semanal, Marcación rápida, Directorio) ordenadas por empresa → punto → nombre
  (`byCompany`), con barra de color por empresa (`companyColor`, estable por id). En el Directorio, el
  nombre/empresa abre Control semanal enfocado en ese guardia (`openInWeek` → `focusGuardId`, etiqueta con ✕).
  El enfoque es temporal: se quita al navegar por el menú, cambiar empresa/punto o buscar. **No** usar el
  buscador para esto: es compartido por todas las secciones y dejaba la lista filtrada.
- Reportes: dos vistas (`components/ReportViews.tsx`): «Detalle por fecha» (la original) y «Resumen y
  calendario» (resumen por causa agrupado por empresa con subtotales + calendario de colores). Descargas en
  Excel (4 hojas, exceljs) y PDF (jspdf + autotable), generadas en el navegador (`lib/reportExport.ts`, carga
  diferida). Presente = sin causa registrada, abreviado ✓ («P» es Festivo público / oficial).
- En tablas HTML, la barrita de color va en la **primera celda** (`td.company-bar`), nunca en el `tr`:
  el `::before` en un `tr` crea una columna fantasma y desalinea las columnas.
- Ausencias del día: cualquier causa registrada cuenta como 1 (decisión del usuario, incluido medio día).
- Días administrativos: causa `A` (factor 0, permiso con goce de sueldo), 6 por guardia por **año calendario**
  (`server/adminDays.ts`). Si ya tiene uno ese mes se pide confirmación; al llegar a 6 se **bloquea**
  (también en el servidor, en la ruta `mark`). Tras registrar se informa cuántos lleva en el año.

## Pruebas locales

- PostgreSQL local: `service postgresql start` (se apaga si la sesión se reinicia; los errores
  "Failed query" en pruebas suelen ser eso, no un fallo de la app).
- Para simular la base actual: aplicar solo la migración anterior (`git stash push drizzle-pg`),
  insertar datos y luego migrar.
- Correo: un SMTP de prueba local en otro puerto con `SMTP_HOST=127.0.0.1` captura los enlaces.
- `pnpm check`, `pnpm test`, `pnpm build`; capturas con Playwright en 1366×768 y 390×844.
