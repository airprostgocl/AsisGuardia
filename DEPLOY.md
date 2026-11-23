# Despliegue en VPS (Hostinger) con Docker + Traefik

Guía para un VPS que ya ejecuta n8n con Traefik (plantilla de Hostinger). La app se suma a
ese Traefik: no ocupa los puertos 80/443 y obtiene su certificado HTTPS automáticamente.

## 1. Dominio

En el panel DNS de tu dominio crea un registro **A**:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `asistencia` (o el subdominio que quieras) | IP del VPS |

Espera a que propague (`ping asistencia.tudominio.cl` debe responder con la IP del VPS).

## 2. Datos de tu Traefik

Conéctate al VPS (`ssh root@IP_DEL_VPS` o la terminal del panel de Hostinger) y ejecuta:

```bash
docker ps --format '{{.Names}}'
```

Anota el nombre del contenedor de Traefik (por ejemplo `root-traefik-1`) y úsalo aquí:

```bash
docker inspect root-traefik-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

```bash
docker inspect root-traefik-1 --format '{{json .Args}}'
```

- El primer comando da la **red** (normalmente `root_default`) → `TRAEFIK_NETWORK`.
- En el segundo busca `--entrypoints.XXX.address=:443` → `TRAEFIK_ENTRYPOINT` (normalmente `websecure`)
  y `--certificatesresolvers.YYY.acme` → `TRAEFIK_CERTRESOLVER` (normalmente `mytlschallenge`).

## 3. Descargar el proyecto

```bash
git clone https://github.com/airprostgocl/AsisGuardia.git /opt/guardiaflow
```

```bash
cd /opt/guardiaflow
```

Si el repositorio es privado, git pedirá usuario y contraseña: usa tu usuario de GitHub y,
como contraseña, un *token* (GitHub → Settings → Developer settings → Personal access tokens,
permiso de solo lectura sobre el repositorio).

## 4. Configurar `.env`

```bash
cp .env.example .env
```

Genera una clave de sesión y cópiala:

```bash
openssl rand -hex 32
```

```bash
nano .env
```

Completa como mínimo:

- `SUPABASE_POOLER_DATABASE_URL` — la URL de conexión de Supabase.
- `SESSION_SECRET` — la clave generada arriba.
- `INITIAL_SUPERVISOR_PASSWORD` — solo importa si la base de datos está vacía.
- `APP_DOMAIN`, `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT`, `TRAEFIK_CERTRESOLVER` — del paso 1 y 2.

Si algún valor contiene el carácter `$`, escríbelo como `$$`.

## 5. Arrancar

```bash
docker compose up -d --build
```

La primera compilación tarda unos minutos. Comprueba el estado y los logs:

```bash
docker compose ps
```

```bash
docker compose logs -f guardiaflow
```

Debe aparecer `Server listening on port 3000`. Abre `https://APP_DOMAIN` en el navegador.

Si la base de datos es nueva (vacía), crea las tablas una vez:

```bash
docker compose run --rm guardiaflow pnpm db:migrate
```

## Actualizar a una versión nueva

```bash
cd /opt/guardiaflow && git pull && docker compose up -d --build
```

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| `network root_default not found` | `TRAEFIK_NETWORK` no coincide con la red del paso 2. |
| `404 page not found` en el navegador | Traefik no ve la app: revisa `TRAEFIK_NETWORK` y `TRAEFIK_ENTRYPOINT`. |
| Aviso de certificado no válido | El DNS aún no propaga o `TRAEFIK_CERTRESOLVER` es incorrecto. Revisa `docker logs root-traefik-1`. |
| El contenedor se reinicia con `SESSION_SECRET ... obligatorio` | Falta `SESSION_SECRET` en `.env`. |
| Login no mantiene la sesión | Estás entrando por `http://` o por IP; usa `https://` con el dominio. |
