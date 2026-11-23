# Despliegue en VPS (Hostinger) con Docker + Nginx

Guía para un VPS donde **Nginx está instalado en el sistema** (fuera de Docker), atiende los
puertos 80/443 y sirve otros sitios. La app corre en Docker escuchando solo en
`127.0.0.1:3010`; Nginx le reenvía las visitas a su dominio y certbot pone el HTTPS.
Los demás sitios y contenedores no se modifican.

Dominio: `guardian.agenciaiachile.site` (registro A → IP del VPS).

## 1. Descargar el proyecto

```bash
git clone -b claude/busy-dirac-f169b6 https://github.com/airprostgocl/AsisGuardia.git /opt/guardiaflow
```

```bash
cd /opt/guardiaflow
```

Si el repositorio es privado, usa tu usuario de GitHub y, como contraseña, un token
(Fine-grained, solo este repositorio, permiso *Contents: Read-only*).

## 2. Configurar `.env`

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
- `APP_PORT` — déjalo en `3010` (debe estar libre: `ss -tlnp | grep :3010` no debe mostrar nada).
- `APP_URL` — `https://guardian.agenciaiachile.site` (obligatoria para los enlaces de recuperación).
- `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — cuenta de Gmail que envía los correos de recuperación de
  contraseña. `SMTP_PASS` es la **contraseña de aplicación de Gmail** (ver más abajo), no la contraseña normal.

Si algún valor contiene el carácter `$`, escríbelo como `$$`.

## 3. Arrancar la app

```bash
docker compose up -d --build
```

La primera compilación tarda unos minutos. Comprueba:

```bash
docker compose logs --tail 20 guardiaflow
```

Debe aparecer `Server listening on port 3000`. Y desde el VPS:

```bash
curl -s http://127.0.0.1:3010/api/health
```

Debe responder `{"status":"ok"}`.

## 4. Publicar con Nginx

```bash
cp /opt/guardiaflow/deploy/nginx/guardian.conf /etc/nginx/sites-available/guardian
```

```bash
ln -s /etc/nginx/sites-available/guardian /etc/nginx/sites-enabled/guardian
```

Verifica la configuración **antes** de recargar (si da error, no recargues y revisa):

```bash
nginx -t
```

```bash
systemctl reload nginx
```

`reload` aplica el cambio sin cortar los demás sitios.

## 5. HTTPS

```bash
certbot --nginx -d guardian.agenciaiachile.site
```

Si pregunta por redirección, elige redirigir HTTP a HTTPS. Certbot solo modifica el
archivo de este sitio y renueva el certificado automáticamente.

Abre `https://guardian.agenciaiachile.site`.

## Contraseña de aplicación de Gmail

Necesaria para que la app envíe los correos de «¿Olvidaste tu contraseña?».

1. Entra a la cuenta de Gmail que enviará los correos.
2. Activa la verificación en 2 pasos (myaccount.google.com → Seguridad), si no está activa.
3. Abre myaccount.google.com/apppasswords, escribe un nombre (ej. `GuardiaFlow`) y pulsa **Crear**.
4. Copia las 16 letras **sin espacios** en `SMTP_PASS`.

## Migraciones de base de datos

Cuando una versión nueva agrega cambios a la base de datos (archivos en `drizzle-pg/`), aplícalos así:

```bash
cd /opt/guardiaflow && docker compose run --rm guardiaflow pnpm db:migrate
```

## Actualizar a una versión nueva

```bash
cd /opt/guardiaflow && git pull && docker compose up -d --build
```

Si la versión trae migraciones, aplícalas (sección anterior) antes de recrear el contenedor.

## Comandos útiles

| Acción | Comando (dentro de `/opt/guardiaflow`) |
|---|---|
| Ver estado | `docker compose ps` |
| Ver logs | `docker compose logs -f guardiaflow` |
| Reiniciar | `docker compose restart guardiaflow` |
| Detener solo esta app | `docker compose down` |

No uses `docker system prune` ni `docker compose down` en carpetas de otros proyectos.

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| `502 Bad Gateway` | La app no está corriendo o `APP_PORT` no coincide con `proxy_pass` en el archivo de Nginx. |
| `port is already allocated` | El puerto 3010 está ocupado: cambia `APP_PORT` en `.env` y `proxy_pass` en `/etc/nginx/sites-available/guardian`. |
| El contenedor se reinicia con `SESSION_SECRET ... obligatorio` | Falta `SESSION_SECRET` en `.env`. |
| Se abre otro sitio en vez de la app | Falta el enlace en `sites-enabled` o no se recargó Nginx. |
| Login no mantiene la sesión | Estás entrando por `http://`; usa `https://` (paso 5). |
