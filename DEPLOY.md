# Publicar PUPE en tu servidor Debian con Cloudflare Tunnel

Guía para un servidor Debian sin Docker que ya tiene un túnel de `cloudflared` funcionando con otra aplicación.
PUPE se agrega como **un servicio más** en el mismo túnel, con su propio subdominio. La otra aplicación no se toca.

```
Usuario ──HTTPS──▶ Cloudflare (captcha Turnstile, WAF)
                      │ túnel cloudflared (sin abrir puertos)
                      ▼
               Servidor Debian
               ├─ tu otra app            (sin cambios)
               ├─ pupe.service  → 127.0.0.1:3000  (API + app compilada, UN solo proceso)
               └─ PostgreSQL    → 127.0.0.1:5432  (solo local)
```

En los ejemplos se usa `pupe.frwxz.com`. En los comandos, `tu-usuario` es tu usuario normal del servidor (el que usa `sudo`).

> **Un solo proceso.** La API guarda una copia de la base en memoria y escribe solo los cambios.
> Nunca corras dos copias a la vez (por ejemplo `npm start` además de `pupe.service`): se pisarían los datos.

---

## 1. Node.js 22 o 24

```bash
node -v
```

Necesitas **22.12 o superior** (o 20.19 o superior); la compilación usa Vite 8, que no funciona con versiones anteriores.
Si no está instalado o la versión es menor (Debian 12 trae la 18), instala Node 24 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

> Si tu otra aplicación depende de una versión específica de Node, revisa que siga funcionando después de actualizar.

## 2. PostgreSQL

Genera una contraseña larga **solo con letras y números**, porque va dentro de una URL y los símbolos como `@ : / #` la romperían:

```bash
openssl rand -hex 24          # copia el resultado; es la contraseña de la base
sudo apt install -y postgresql
sudo -u postgres createuser --pwprompt pupe     # pega la contraseña generada
sudo -u postgres createdb -O pupe pupe
```

En Debian, PostgreSQL solo escucha en `localhost` por defecto, así que no queda expuesto a internet.

## 3. Usuario del sistema y código

Crea el usuario que **correrá** PUPE, sin acceso a la terminal y sin permiso para modificar el código:

```bash
sudo useradd --system --home /opt/pupe --shell /usr/sbin/nologin pupe
getent group pupe || sudo groupadd --system pupe     # en Debian ya existe; esto solo lo confirma
```

La compilación se hace con **tu usuario normal**, no con `root`, para que los scripts de instalación de npm no corran con privilegios de administrador:

```bash
sudo mkdir -p /opt/pupe
sudo chown tu-usuario: /opt/pupe
```

Desde tu computadora (Kali), copia el proyecto sin carpetas generadas ni tu `.env.local`, que tiene tus llaves:

```bash
rsync -av --delete \
  --exclude node_modules --exclude .pgdata --exclude dist --exclude dist-server \
  --exclude test-results --exclude playwright-report --exclude .env.local \
  ~/Documentos/Ing_software/pupe-app/ tu-usuario@tu-servidor:/opt/pupe/
```

En el servidor, como tu usuario (sin `sudo`):

```bash
cd /opt/pupe
npm ci
npm run build
npm prune --omit=dev
chmod -R a+rX /opt/pupe        # que el usuario pupe pueda leer todo
```

El usuario `pupe` puede leer los archivos, pero no modificarlos.

## 4. Captcha (Cloudflare Turnstile)

1. En el panel de Cloudflare, entra a **Turnstile → Add widget**.
2. **Hostname:** `pupe.frwxz.com`. **Widget mode:** *Managed*.
3. Copia la **Site Key** y la **Secret Key** para el paso 5.

La Secret Key solo va en el servidor y nunca se envía al navegador.

## 4b. Correo para los códigos de verificación (Brevo)

Al registrarse, el alumno recibe un código de 6 dígitos en su correo BUAP. La cuenta no existe hasta que lo escribe.
Si ya lo probaste en tu computadora con `.env.local`, este paso ya está hecho: usa los mismos 5 valores.

Resumen de lo que debe estar listo en Brevo:

- **Dominio** `frwxz.com` autenticado, en *Remitentes, dominio, IP → Dominios*. Brevo da el registro `brevo-code` y la firma **DKIM**; en Cloudflare, los CNAME van con la nube gris (*DNS only*).
- **SPF:** un solo registro TXT `v=spf1 …` para el dominio. Si usas Email Routing de Cloudflare, debe quedar así:
  `v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`
- **DMARC:** es un registro **tuyo**, no de Brevo: un TXT en `_dmarc.frwxz.com`, por ejemplo `v=DMARC1; p=none; rua=mailto:no-responder@frwxz.com`. Brevo solo revisa que exista.
- **Remitente** `no-responder@frwxz.com` verificado.
- **Clave SMTP** generada en *SMTP y API → SMTP*. El usuario es el **Login** de esa página (`…@smtp-brevo.com`), no tu correo.

Los cinco valores son **obligatorios**: sin `SMTP_USER` y `SMTP_PASS` el servidor no arranca en producción.

## 5. Variables de entorno

```bash
sudo mkdir -p /etc/pupe
sudo cp /opt/pupe/.env.example /etc/pupe/pupe.env
sudo chmod 600 /etc/pupe/pupe.env
sudo nano /etc/pupe/pupe.env
```

El archivo completo debe quedar así (cambia lo que está en MAYÚSCULAS):

```ini
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
PUBLIC_URL=https://pupe.frwxz.com
DATABASE_URL=postgres://pupe:CONTRASEÑA_DEL_PASO_2@127.0.0.1:5432/pupe

TURNSTILE_SITE_KEY=SITE_KEY_DEL_PASO_4
TURNSTILE_SECRET_KEY=SECRET_KEY_DEL_PASO_4

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=LOGIN@smtp-brevo.com
SMTP_PASS=CLAVE_SMTP
SMTP_FROM=PUPE CU2 <no-responder@frwxz.com>

COOKIE_SECURE=true
TRUST_CLOUDFLARE=true
DEMO_MODE=false
DEMO_PASSWORD=

SESSION_HOURS=12
MAX_FAILED_LOGINS=5
LOCK_MINUTES=15
AUTH_RATE_LIMIT=20
```

| Variable | Notas |
|---|---|
| `NODE_ENV` | **Siempre `production`.** Sin esto la app arranca en modo desarrollo: cookie no segura, sin revisión de configuración y con datos demo. El servicio también lo fija por si acaso |
| `PORT` | Cualquier puerto libre. Revisa cuáles usa tu otra app con `sudo ss -ltnp` |
| `PUBLIC_URL` | Debe empezar con `https://` y no llevar ruta. Si está mal escrita, el servidor no arranca y te dice por qué |
| `DATABASE_URL` | La **URL completa**, no solo la contraseña |
| `DEMO_MODE` | `false` para uso real. Para una presentación con datos de ejemplo usa otra base (ver más abajo) |
| `AUTH_RATE_LIMIT` | Intentos por IP cada 15 minutos en cada ruta de acceso (login, registro, verificación). Si muchos alumnos entran desde la red de CU2 salen con la misma IP; si ves errores de "Demasiadas solicitudes", súbelo (por ejemplo a 100) |
| `HOST` | Déjalo en `127.0.0.1`. Con `TRUST_CLOUDFLARE=true` el servidor se niega a escuchar en otra dirección |

Es importante **no poner comentarios al final de una línea**: systemd los tomaría como parte del valor.

En producción el servidor **no arranca** si:
- falta `DATABASE_URL`, `PUBLIC_URL`, alguna llave de Turnstile o alguno de los cuatro datos SMTP;
- `PUBLIC_URL` no es `https://`;
- la cookie no es segura;
- la base tiene cuentas demo con `DEMO_MODE=false`.

El error aparece en `journalctl -u pupe`.

## 6. Primer super administrador

En una base nueva con `DEMO_MODE=false` no existe ninguna cuenta. Crea la tuya **antes** de arrancar el servicio; la contraseña se pide sin mostrarse:

```bash
sudo systemd-run --pty --wait --collect --uid=pupe \
  -p EnvironmentFile=/etc/pupe/pupe.env -p WorkingDirectory=/opt/pupe \
  /usr/bin/node dist-server/cli.js crear-admin \
  --nombre "Diana L. Romero" --correo tu.correo@correo.buap.mx --matricula 202000001
```

Con el mismo formato, cambiando el final, tienes:

| Comando | Para qué |
|---|---|
| `cambiar-password --correo X` | Restablece la contraseña de alguien y cierra sus sesiones. Normalmente no hace falta: cada usuario puede usar **¿Olvidaste tu contraseña?** en el login |
| `desbloquear --correo X` | Quita el bloqueo por intentos fallidos |
| `cerrar-sesiones --correo X` | Cierra todas las sesiones de esa cuenta |

Si usas `crear-admin` con el servicio ya corriendo, reinícialo después (`sudo systemctl restart pupe`) para que la API vea la cuenta nueva. Los otros tres comandos no lo necesitan.

Los encargados se crean desde la app: **Panel global → Crear cuenta de encargado**, con una contraseña inicial que pueden cambiar en **Mi perfil**.

## 7. Servicio de systemd

```bash
sudo cp /opt/pupe/deploy/pupe.service /etc/systemd/system/pupe.service
sudo systemctl daemon-reload
sudo systemctl enable --now pupe
sudo systemctl status pupe
curl -s http://127.0.0.1:3000/api/config      # cambia 3000 si usaste otro PORT
```

El último comando debe mostrar tu `captchaSiteKey` y `"demo":false`. Para ver los registros: `journalctl -u pupe -f`.
Si la configuración tiene un error, el servicio lo intenta 3 veces y se detiene; corrige el archivo y usa `sudo systemctl restart pupe`.

## 8. Agregar PUPE al túnel de cloudflared

Usa **`127.0.0.1`** y no `localhost`: PUPE solo escucha en IPv4, y en algunos sistemas `localhost` se resuelve primero como IPv6.

Revisa cómo está configurado tu túnel:

```bash
systemctl cat cloudflared | grep ExecStart
```

### Si la línea tiene `--token` (túnel administrado desde el panel)

1. Entra a Cloudflare **Zero Trust → Networks → Tunnels**, elige tu túnel y abre **Public Hostname → Add a public hostname**.
2. Llena:
   - **Subdomain:** `pupe`
   - **Domain:** `frwxz.com`
   - **Type:** `HTTP`
   - **URL:** `127.0.0.1:3000`
3. Guarda. No hace falta reiniciar nada.

### Si usa un archivo de configuración (`/etc/cloudflared/config.yml`)

Agrega la regla de PUPE **antes** de la regla final `http_status:404`, sin tocar la de tu otra app:

```yaml
ingress:
  - hostname: app-existente.frwxz.com   # tu app actual, sin cambios
    service: http://127.0.0.1:8080
  - hostname: pupe.frwxz.com            # ← nueva
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Valida, crea el DNS y reinicia el túnel:

```bash
sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate
sudo cloudflared tunnel route dns NOMBRE_DEL_TUNEL pupe.frwxz.com
sudo systemctl restart cloudflared
```

## 9. Ajustes recomendados en Cloudflare

En el panel de `frwxz.com`:

- **SSL/TLS → Edge Certificates:** activa *Always Use HTTPS*.
- **Security → WAF → Rate limiting rules:** una regla para la ruta `/api/auth/` que bloquee IPs con demasiadas peticiones. Es una segunda barrera además del límite de la API. El plan gratuito permite una regla de este tipo.
- **Security → Bots:** *Bot Fight Mode* es opcional.

## 10. Checklist antes de anunciarlo

- [ ] `/etc/pupe/pupe.env` tiene `NODE_ENV=production`, permisos `600` y ninguna línea con comentario al final.
- [ ] `DATABASE_URL` es la URL completa y la contraseña solo tiene letras y números.
- [ ] La base es nueva o limpia: `curl -s http://127.0.0.1:3000/api/config` muestra `"demo":false`.
- [ ] Turnstile usa las llaves reales y el hostname `pupe.frwxz.com`.
- [ ] `COOKIE_SECURE=true`, `TRUST_CLOUDFLARE=true` y `HOST=127.0.0.1`.
- [ ] `sudo systemctl status pupe` muestra *active (running)*.
- [ ] El túnel apunta a `127.0.0.1:3000` (o tu `PORT`).
- [ ] En `https://pupe.frwxz.com` el login muestra la verificación de Cloudflare y entras con tu cuenta de super administrador.
- [ ] Un registro real con un correo BUAP recibe el código y crea la cuenta.
- [ ] `curl -sI https://pupe.frwxz.com | grep -iE "strict-transport|content-security"` muestra ambas cabeceras.
- [ ] Con 5 contraseñas incorrectas seguidas, la cuenta se bloquea 15 minutos.
- [ ] Hiciste un respaldo y **probaste restaurarlo** (ver "Respaldos").

## Pasar de demo a producción

Si en algún momento arrancaste el servidor con `DEMO_MODE=true`, la base conserva las cuentas de ejemplo aunque después cambies a `false`.
El servidor lo detecta y no arranca. Para empezar con una base limpia (**esto borra todos los datos**):

```bash
sudo systemctl stop pupe
sudo -u postgres dropdb pupe
sudo -u postgres createdb -O pupe pupe
# repite el paso 6 (crear-admin) y luego:
sudo systemctl start pupe
```

Para una presentación con datos de ejemplo sin tocar la base real, crea otra base (por ejemplo `pupe_demo`) y otro servicio con su propio archivo de variables, `PORT`, `DEMO_MODE=true` y `DEMO_PASSWORD`.

## Actualizar a una versión nueva

Con el servicio detenido, para que no sirva archivos a medio copiar:

```bash
# 1) En el servidor: detener y respaldar
sudo systemctl stop pupe
sudo /usr/local/bin/pupe-backup

# 2) En tu computadora: copiar el código nuevo (mismo rsync del paso 3)

# 3) En el servidor, como tu usuario:
cd /opt/pupe && npm ci && npm run build && npm prune --omit=dev && chmod -R a+rX /opt/pupe

# 4) Arrancar y revisar
sudo systemctl start pupe
sudo systemctl status pupe
```

Los datos viven en PostgreSQL, así que actualizar no los borra. La app queda fuera de línea solo mientras se compila (alrededor de un minuto).

## Respaldos

```bash
sudo cp /opt/pupe/deploy/backup.sh /usr/local/bin/pupe-backup
sudo chmod 700 /usr/local/bin/pupe-backup
sudo /usr/local/bin/pupe-backup      # primer respaldo, para probar
sudo crontab -e                      # agrega:  30 3 * * * /usr/local/bin/pupe-backup
```

Se guarda un respaldo diario en `/var/backups/pupe`, solo legible por root, y se conservan los últimos 14 días. Cada respaldo incluye:
- la base de datos (`pupe-FECHA.dump`);
- una copia de `/etc/pupe/pupe.env` (`pupe-env-FECHA`), porque las llaves no están en PostgreSQL.

**Prueba restaurar** al menos una vez, en una base aparte, para no tocar la real:

```bash
sudo -u postgres createdb -O pupe pupe_prueba
sudo -u postgres pg_restore -d pupe_prueba /var/backups/pupe/pupe-AAAA-MM-DD-HHMM.dump
sudo -u postgres psql -d pupe_prueba -c "SELECT count(*) FROM users;"
sudo -u postgres dropdb pupe_prueba
```

Para restaurar de verdad:

```bash
sudo systemctl stop pupe
sudo -u postgres pg_restore --clean -d pupe /var/backups/pupe/pupe-AAAA-MM-DD-HHMM.dump
sudo systemctl start pupe
```

## Qué protege el login

| Medida | Dónde |
|---|---|
| Captcha Cloudflare Turnstile, validado en el servidor | `server/security.ts` |
| Contraseñas con Argon2id. Mínimo 10 caracteres, con letras y números, sin la matrícula | `server/security.ts`, `src/lib/validators.ts` |
| Bloqueo de 15 minutos después de 5 intentos fallidos | `server/security.ts` |
| Límite de intentos por IP, usando la IP real que manda Cloudflare | `server/app.ts` |
| Cookie `__Host-` con `HttpOnly`, `Secure` y `SameSite=Strict`. En la base solo se guarda el hash del token | `server/security.ts` |
| Mismo mensaje para correo inexistente y contraseña incorrecta | `server/app.ts` |
| Registro con código de 6 dígitos enviado al correo. Vence en 15 minutos, admite 5 intentos y solo se puede reenviar cada 60 segundos; en la base solo se guarda su hash | `server/verification.ts`, `server/mail.ts` |
| Protección CSRF: verifica el `Origin` en cada petición que cambia datos | `server/app.ts` |
| Cabeceras de seguridad: CSP, HSTS, `X-Frame-Options`, `nosniff` | `server/app.ts` |
| Permisos y reglas de negocio validados en el servidor; los campos extra se ignoran | `src/lib/rules.ts`, `server/input.ts` |
| Cada usuario recibe solo los datos que su rol puede ver | `server/view.ts` |
| Inicios de sesión, intentos fallidos y bloqueos registrados en la bitácora | `server/app.ts` |
| Recuperar contraseña con código por correo: misma respuesta exista o no la cuenta, 15 minutos, 5 intentos; al cambiarla se cierran todas las sesiones y se quita el bloqueo | `server/passwordReset.ts` |
| En producción no arranca con configuración incompleta, `PUBLIC_URL` inválida o cuentas demo en la base | `server/config.ts`, `server/index.ts` |
