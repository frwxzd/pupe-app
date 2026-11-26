# PUPE · Plataforma Universitaria de Objetos Perdidos y Encontrados

Prototipo académico para Ciudad Universitaria 2 (CU2) · BUAP.
Basado en `../Indicaciones_PUPE.pdf` (especificación funcional v1.0).

## Cómo correrlo

La app tiene dos partes: la interfaz (React) y una API en Node con PostgreSQL que guarda los datos,
valida el login y aplica todas las reglas.

```bash
cd pupe-app
npm install
npm run db:local     # PostgreSQL de desarrollo dentro del proyecto (.pgdata, puerto 5433)
npm run dev:api      # API en http://127.0.0.1:3000 (terminal 1)
npm run dev          # interfaz en http://localhost:5173 (terminal 2)
npm run build        # producción: dist/ (interfaz) y dist-server/ (API)
npm run test:e2e     # pruebas Playwright contra la API real
```

`./scripts/db-local.sh stop` detiene el PostgreSQL de desarrollo.
En desarrollo el captcha está apagado y el modo demo está activo. En modo demo, el super
administrador tiene el botón **Restablecer demo** para volver a los datos iniciales.

Para publicarlo en un servidor con Cloudflare Tunnel, sigue **[DEPLOY.md](DEPLOY.md)**.

## Cuentas de demostración

Solo existen con `DEMO_MODE=true` (por defecto en desarrollo) y no aparecen en la pantalla de login.
Los correos y la contraseña están en un archivo aparte, fuera del proyecto (`../cuentas-demo-pupe.txt`).
En producción, la contraseña de esas cuentas se define con la variable `DEMO_PASSWORD`.

## Stack

React + Vite + TypeScript + Tailwind CSS v4 · React Router · Tabler Icons · signature_pad · fuente Lato (local).
API: Node + Fastify · PostgreSQL · Argon2id · Cloudflare Turnstile.

## Estructura

```
src/
  pages/        Login, Terminos, Inicio, Catalogo, Detalle, Reclamo, MisReclamos, Entregar,
                PanelEncargado, NuevoEncontrado (también edición), Documentos (Recibo y Acta),
                Reclamos (bandeja y revisión), ActaEntrega, Bitacora, PanelSuperAdmin, Perfil
  components/   Header (TopBar, Navbar, Footer), ItemCard, ServiceCard, StatusBadge,
                SignaturePad, PhotoUploader, Guard (rutas por rol), BuildingScope, ui
  lib/          types, constants (dominios, categorías, términos), seed, permissions (matriz),
                rules (reglas de negocio, compartidas con el servidor), dbutil, queries,
                validators, images, format
                api, storage, auth, actions: cliente de la API en el navegador
server/         API: app (rutas), security (contraseñas, sesiones, captcha), store (PostgreSQL),
                view (qué datos ve cada rol), input (validación de entradas), cli (administración)
deploy/         Servicio de systemd y script de respaldos
scripts/        db-local.sh (PostgreSQL de desarrollo)
public/
  brand/        Logos BUAP y CU2
  demo/         Fotos de los objetos de ejemplo (ver CREDITOS.md)
```

## Decisiones tomadas

- **Las reglas se validan en el servidor** (`lib/rules.ts`, ejecutadas por `server/app.ts`). Un encargado
  no puede ver ni modificar datos de otro edificio aunque cambie la URL o arme la petición a mano, y el
  navegador solo recibe lo que su rol puede ver (`server/view.ts`).
- **Términos obligatorios para alumnos.** Para reclamar, también el super admin debe aceptarlos.
- **Folios** por edificio, compartidos por recibos y actas: `PUPE-EMA1-0001`.
- **Identificaciones y tarjetas** se publican con una imagen genérica de "foto protegida".
- **Estados**: un reclamo pasa a "En revisión" cuando el encargado lo abre; en ese momento el objeto
  también pasa a "En revisión". Al rechazarlo, el objeto regresa a "En resguardo" si no tiene otros reclamos.
- **Entrega solo al titular**: el acta bloquea la matrícula del alumno que reclamó. Si otra persona
  debe recibir el objeto, hace falta un flujo de autorización que todavía no existe.
- **Ciclo de archivo**: En resguardo → No reclamado → Archivado. Nunca se borra nada.
- **Datos semilla**: la especificación pide la mochila "En resguardo" con un reclamo "En revisión", y
  la botella "Devuelto" con un reclamo "Aprobado". Para que fuera coherente:
  la mochila quedó "En revisión", la botella tiene su reclamo "Entregado" con acta, y se agregó un
  reclamo **aprobado** para la calculadora para poder demostrar el acta de entrega.

## Base de datos

PostgreSQL con una tabla por colección (`users`, `items`, `claims`, `deliveries`, `logs`, …) más
`credentials` (hash Argon2id, intentos fallidos, bloqueo) y `sessions` (hash del token, vencimiento).
El esquema se crea solo al arrancar. La API mantiene una copia en memoria y escribe en una
transacción solo los registros que cambian, así que debe correr **un solo proceso**.

## Pruebas de extremo a extremo

```bash
npm run db:local      # las pruebas usan la base pupe_test del PostgreSQL local
npm run test:e2e      # 23 pruebas en Chromium
npm run test:e2e:ui   # modo interactivo de Playwright
```

Las pruebas cubren:

- Bloqueo del catálogo hasta aceptar términos.
- Flujo completo: alumno reclama → encargado aprueba → acta de entrega → objeto devuelto.
- Aislamiento por rol y por edificio.
- Matrícula bloqueada en el acta: solo recibe el alumno que reclamó.
- Objetos devueltos sin botón de edición.
- Reclamos cerrados sin acciones de decisión.
- Panel global con los 15 edificios.
- Seguridad: bloqueo tras 5 intentos, mismo mensaje para correo inexistente, cookie `HttpOnly` y
  `SameSite=Strict`, contraseña segura al registrarse, el alumno no recibe datos privados, rechazo de
  peticiones sin sesión, de otro origen o sin permiso, y campos manipulados ignorados.
- Registro con código por correo: la cuenta no existe hasta verificar, el código incorrecto descuenta
  intentos, 5 fallos anulan el registro y hay espera de 60 segundos para reenviar.
- Recuperar contraseña por correo: cambia la clave y cierra las sesiones abiertas, la respuesta no revela si
  el correo existe y 5 códigos incorrectos anulan la solicitud.
- En desarrollo, sin SMTP configurado, el código aparece en la consola de `npm run dev:api`.

Por defecto usan `/usr/bin/chromium`. Si tu Chromium está en otra ruta:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium npm run test:e2e
```

