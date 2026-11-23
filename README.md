# AsisGuardia / GuardiaFlow

Control de asistencia para supervisores de guardias, turnos, ausencias y reportes.

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.
- Despliegue en VPS con Docker + Traefik: ver `DEPLOY.md`.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

## Persistencia

La aplicación usa PostgreSQL en Supabase mediante `SUPABASE_POOLER_DATABASE_URL`. Las credenciales se configuran como secretos del entorno y no deben guardarse en el repositorio. El esquema y la migración reproducible están en `drizzle/schema.ts` y `drizzle-pg/`.

## Configuración

Copia `.env.example` a `.env` y completa los valores. En producción son obligatorios:

- `SESSION_SECRET` (o `MANUS_JWT_SECRET`): sin ella el servidor no arranca.
- `INITIAL_SUPERVISOR_PASSWORD`: contraseña del primer supervisor. Si falta, se genera una aleatoria y se muestra una sola vez en el log.

En desarrollo, el supervisor inicial es `supervisor` / `GuardiaFlow2026!` salvo que se definan las variables `INITIAL_SUPERVISOR_*`.
