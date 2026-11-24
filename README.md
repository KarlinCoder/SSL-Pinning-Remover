# APK HTTPS Lab

**Prepara cualquier APK, XAPK o APKS para inspección HTTPS desde una URL directa.**

APK HTTPS Lab es una aplicación web genérica que descarga un paquete Android en el servidor, lo parchea con [apk-mitm](https://github.com/niklashigi/apk-mitm) para neutralizar el certificate pinning y la configuración de red, lo firma de nuevo y te ofrece un enlace temporal de descarga. Todo el procesamiento ocurre dentro de Docker: no necesitas Java, apktool ni ninguna herramienta en tu equipo.

> Úsalo únicamente con aplicaciones y dispositivos que controles o para los que tengas autorización expresa.

---

## Qué incluye

- Interfaz web en español con estética negra, acento lima y diseño responsive.
- Descarga server-side desde una URL directa (`.apk`, `.xapk`, `.apks` o `.zip` con APKs).
- Detección automática del formato y parcheo con **apk-mitm 1.3.0**.
- Recompilación con **apktool** y firma automática con **uber-apk-signer**.
- Logs en vivo por **SSE** (Server-Sent Events), con reconexión y polling de respaldo.
- Cola de trabajos, cancelación, timeout, límite de tamaño y limpieza automática por TTL.
- Login opcional por contraseña mediante cookie firmada.
- Protección anti-SSRF, rate limiting y cabeceras de seguridad.
- Dockerfile y Docker Compose listos para una VPS.

### Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4 |
| Backend | Node.js 24, Express 5, TypeScript |
| Motor de parcheo | apk-mitm 1.3.0 |
| Herramientas Java | apktool 3.0.3 (respaldo 2.9.3), uber-apk-signer 1.3.0 |
| Runtime | Docker, OpenJDK 17, `zip`/`unzip` |
| Gestor de paquetes | pnpm 10 |

---

## Inicio rápido en una VPS

### Requisitos

- Docker Engine 24 o superior.
- Docker Compose v2 (`docker compose`).
- Acceso a Internet desde la VPS para descargar el paquete y, durante el build, las herramientas Java.
- Recomendado: 2 vCPU, 4 GB de RAM y 20 GB de disco libre. Para APKs de ~1 GB, deja bastante más espacio: apktool puede necesitar 4–6 veces el tamaño del archivo.

### 1. Copia el proyecto a la VPS

```bash
mkdir -p /opt/apk-https-lab
cd /opt/apk-https-lab
# Sube aquí el contenido del proyecto (Dockerfile, docker-compose.yml, apps/, etc.)
```

### 2. Configura las variables

```bash
cp .env.example .env
nano .env
```

Como mínimo, cambia:

```env
APP_PASSWORD=una-contraseña-larga-y-única
SESSION_SECRET=un-secreto-largo-y-aleatorio
```

Puedes generar el secreto con:

```bash
openssl rand -hex 32
```

Si vas a servir la app por HTTPS con un proxy inverso, configura también:

```env
APP_BIND=127.0.0.1
COOKIE_SECURE=true
TRUST_PROXY=true
```

### 3. Construye y arranca

```bash
docker compose up -d --build
```

La primera construcción instala Java, pnpm y las dependencias, descarga apktool y uber-apk-signer, y compila el frontend y el backend. Puede tardar varios minutos.

### 4. Comprueba el estado

```bash
docker compose ps
docker compose logs -f app
```

Abre en el navegador:

```text
http://IP-DE-TU-VPS:3000
```

Si configuraste `APP_PASSWORD`, verás la pantalla de acceso.

### 5. Detener o actualizar

```bash
docker compose down          # detener sin borrar datos
docker compose up -d --build # reconstruir tras cambiar código
```

El volumen `apk-data` conserva los trabajos temporales. `docker compose down -v` lo borra todo, incluidos los archivos pendientes de descarga.

---

## HTTPS con Caddy (recomendado)

La forma más sencilla de poner HTTPS delante de la app es usar Caddy en el host.

1. En `.env`:

```env
APP_BIND=127.0.0.1
APP_PORT=3000
COOKIE_SECURE=true
TRUST_PROXY=true
```

2. En `/etc/caddy/Caddyfile`:

```caddyfile
apk.tudominio.com {
    reverse_proxy 127.0.0.1:3000
}
```

3. Recarga Caddy:

```bash
sudo systemctl reload caddy
```

Con `APP_BIND=127.0.0.1`, el puerto 3000 no queda expuesto directamente a Internet: solo Caddy puede acceder a él. Asegúrate de que el firewall de la VPS permite únicamente los puertos 80 y 443 (y SSH).

Si usas Nginx o Traefik, el concepto es el mismo: proxy hacia `127.0.0.1:3000`, `COOKIE_SECURE=true` y `TRUST_PROXY=true`.

---

## Variables de entorno

Todas se configuran en `.env` y se pasan al contenedor desde `docker-compose.yml`.

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `APP_BIND` | `0.0.0.0` | Interfaz del host donde se publica el puerto. Usa `127.0.0.1` detrás de un proxy. |
| `APP_PORT` | `3000` | Puerto público en el host. La app escucha siempre en el 3000 dentro del contenedor. |
| `APP_PASSWORD` | vacío | Contraseña de acceso. Si está vacía, **no hay login**. Configúrala en cualquier VPS pública. |
| `SESSION_SECRET` | vacío | Secreto para firmar la cookie de sesión. Si está vacío se genera uno temporal en cada arranque. |
| `COOKIE_SECURE` | `false` | Marca la cookie como `Secure`. Actívalo solo si sirves la app por HTTPS. |
| `TRUST_PROXY` | `false` | Confía en `X-Forwarded-*` del proxy inverso. Actívalo detrás de Caddy/Nginx/Traefik. |
| `MAX_APK_MB` | `1024` | Tamaño máximo del archivo descargado, en MB. |
| `MAX_CONCURRENT_JOBS` | `1` | Trabajos procesándose a la vez (1–3). |
| `MAX_QUEUE_LENGTH` | `8` | Trabajos máximos en cola. |
| `JOB_TTL_MIN` | `60` | Minutos que se conserva un resultado descargable antes de borrarse. |
| `JOB_TIMEOUT_MIN` | `45` | Tiempo máximo de procesamiento por trabajo. |
| `MAX_LOG_LINES` | `2000` | Líneas de log conservadas por trabajo. |
| `ALLOW_PRIVATE_URLS` | `false` | Permite descargar desde IPs privadas/loopback. **No lo actives en Internet.** |
| `ALLOWED_PORTS` | `80,443` | Puertos de destino permitidos para la descarga. |
| `JAVA_MAX_HEAP_MB` | `2048` | Heap máximo de la JVM usada por apktool/uber-apk-signer. |
| `MAKE_DEBUGGABLE` | `false` | Añade `android:debuggable="true"` a la APK resultante. |
| `APKTOOL_JAR` | `/opt/tools/apktool_3.0.3.jar` | apktool principal. |
| `APKTOOL_FALLBACK_JAR` | `/opt/tools/apktool_2.9.3.jar` | apktool de respaldo si el primero falla. |
| `EXTRA_CA_PATH` | vacío | Ruta **dentro del contenedor** a un certificado `.pem`/`.der` para añadirlo a la network security config. Monta el archivo con un volumen (hay un ejemplo comentado en `docker-compose.yml`). |
| `DATA_DIR` | `/data` | Directorio de trabajos dentro del contenedor. |
| `PORT` | `3000` | Puerto interno del servidor Express. |

### Usar el apktool clásico de apk-mitm

apk-mitm 1.3.0 está diseñado para apktool 2.9.3. La imagen incluye también apktool 3.0.3 para APKs modernas y lo usa por defecto. Si prefieres el comportamiento clásico, intercámbialos en `docker-compose.yml`:

```yaml
APKTOOL_JAR: /opt/tools/apktool_2.9.3.jar
APKTOOL_FALLBACK_JAR: /opt/tools/apktool_3.0.3.jar
```

---

## Cómo funciona

1. **Descarga**: el backend valida la URL, resuelve el DNS, bloquea destinos privados si `ALLOW_PRIVATE_URLS=false`, limita el tamaño y descarga el archivo a `DATA_DIR/jobs/<id>/`.
2. **Detección**: inspecciona el ZIP para distinguir APK, XAPK y APKS.
3. **Parcheo**: ejecuta apk-mitm en un proceso hijo. apk-mitm:
   - decodifica la APK con apktool,
   - modifica el manifest para permitir tráfico claro y usar la network security config,
   - genera `res/xml/nsc_mitm.xml` confiando en certificados de usuario y del sistema,
   - desactiva patrones comunes de certificate pinning en smali,
   - recompila y firma con uber-apk-signer.
4. **Empaquetado**: para XAPK/APKS, parchea el APK base, firma todos los APKs y vuelve a comprimir el paquete.
5. **Resultado**: calcula SHA-256, renombra el archivo, emite el evento final por SSE y publica un enlace temporal.

Los logs de apk-mitm, apktool y uber-apk-signer se transmiten en vivo al navegador. El servidor conserva una copia de los últimos eventos para que puedas reconectar.

---

## Formatos e instalación

| Formato | Contenido | Instalación |
| --- | --- | --- |
| `.apk` | APK única | `adb install archivo.apk` o desde el explorador de archivos |
| `.xapk` | APK base + splits (APKPure) | [SAI (Split APKs Installer)](https://github.com/Aefyr/SAI) |
| `.apks` | APK base + splits (SAI/bundletool) | SAI o `adb install-multiple *.apk` |
| `.zip` | ZIP con APKs | Se trata como `.apks` |

Después de instalar la app parcheada:

1. Instala el certificado CA de mitmproxy en el dispositivo como certificado de usuario.
2. Configura el proxy del dispositivo hacia mitmproxy.
3. Abre la app y revisa el tráfico.

> **Firma diferente**: la APK resultante se firma con una clave de depuración distinta de la original. Normalmente tendrás que desinstalar la app original antes de instalar la parcheada, lo que borra sus datos. Algunas apps detectan la firma o usan Play Integrity/attestation y dejarán de funcionar; apk-mitm no evita esas protecciones.

### XAPK/APKS y `base.apk`

apk-mitm 1.3.0 espera que el APK base de un `.apks` se llame `base.apk` y que los XAPK incluyan un `manifest.json` con la ruta del APK base. Los APKS generados directamente por bundletool con nombres como `base-master.apk` pueden no ser compatibles. Si tienes problemas, prueba con un XAPK de APKPure o extrae/renombra el APK base antes de subirlo.

---

## Seguridad

Esta herramienta descarga y procesa archivos de terceros. Trátala como un servicio sensible.

- **Contraseña obligatoria en Internet**: configura `APP_PASSWORD` y `SESSION_SECRET`. Si `APP_PASSWORD` está vacío, cualquiera puede usar el servicio.
- **HTTPS**: pon Caddy/Nginx delante y activa `COOKIE_SECURE=true` y `TRUST_PROXY=true`.
- **Anti-SSRF**: por defecto solo se permiten destinos públicos en los puertos 80 y 443. Se resuelve el DNS y se fija la IP de conexión para evitar rebinding; las redirecciones se validan una a una.
- **Límites**: tamaño máximo, timeout, cola, concurrencia, rate limiting por IP (10 trabajos cada 10 minutos y 10 intentos de login cada 15 minutos) y comprobación de espacio libre.
- **Aislamiento**: el contenedor corre como usuario no root (`app`, UID 10001), con `no-new-privileges:true`. No se monta el socket de Docker.
- **Datos efímeros**: los trabajos y resultados se guardan en el volumen `apk-data` y se eliminan al expirar el TTL. Aun así, usa una VPS dedicada y no proceses APKs de origen desconocido si no confías en la herramienta.
- **Sin sandbox de malware**: apktool y apk-mitm procesan el archivo, pero no analizan si es malicioso. No instales el resultado en un dispositivo personal sin precauciones.
- **Uso legal**: modificar una APK puede infringir términos de servicio o leyes locales. Usa la herramienta solo con apps y dispositivos propios o con autorización.

---

## Recursos y rendimiento

- El procesamiento es intensivo en CPU, RAM y disco.
- `MAX_CONCURRENT_JOBS=1` es lo recomendado en una VPS pequeña. Súbelo solo si tienes CPU y RAM suficientes.
- Para APKs grandes, apktool necesita espacio temporal equivalente a varias veces el tamaño del archivo. El backend exige al menos `5 × tamaño + 512 MB` libres antes de procesar.
- `JAVA_MAX_HEAP_MB=2048` funciona en la mayoría de casos. Si ves `OutOfMemoryError`, aumenta la RAM de la VPS o el heap.
- El contenedor necesita acceso saliente a GitHub durante el build (herramientas Java) y a la URL del APK durante el procesamiento.

---

## Solución de problemas

### El build falla al descargar apktool o uber-apk-signer

Comprueba que la VPS puede acceder a GitHub. El Dockerfile verifica los SHA-256 de las tres herramientas; si un checksum falla, el build se detiene para evitar usar un binario corrupto. Reintenta con:

```bash
docker compose build --no-cache
```

### Veo `Unrecognized option: --use-aapt2` o `Failed, falling back to AAPT`

Es esperado con apktool 3.0.3. apk-mitm 1.3.0 intenta primero `--use-aapt2`, opción que apktool 3 eliminó; apk-mitm lo detecta y reintenta el build sin esa opción. El trabajo debe continuar. Si termina en error, revisa los logs y prueba el apktool de respaldo (ver “Usar el apktool clásico de apk-mitm”).

### `Could not decode`, `AndrolibException` o errores de recursos

La APK puede estar protegida, usar recursos no soportados o estar corrupta. El backend reintenta automáticamente con el apktool de respaldo si detecta un fallo del motor. Si ambos fallan:

- prueba con otra fuente o versión de la APK;
- si es una app con splits, usa un XAPK/APKS completo;
- revisa los logs completos desde la tarjeta de error.

### La descarga devuelve 403 o una página HTML

La URL debe ser **directa** al archivo. No se admiten páginas de descarga, enlaces que requieran cookies, sesión, Referer especial o captchas. Si el servidor exige login, descarga el archivo por tu cuenta y súbelo a un almacenamiento directo temporal.

### “El enlace apunta a una dirección privada”

El anti-SSRF está bloqueando una IP privada, loopback o un puerto no permitido. En un entorno de laboratorio de confianza puedes activar `ALLOW_PRIVATE_URLS=true` y ajustar `ALLOWED_PORTS`. No lo hagas en una VPS pública.

### “No hay espacio suficiente en el servidor”

Libera espacio o amplía el disco/volumen:

```bash
df -h
docker system df
```

También puedes reducir `MAX_APK_MB` o acortar `JOB_TTL_MIN` para borrar resultados antes.

### “Hay demasiados trabajos en cola”

Espera a que terminen los trabajos actuales. En una VPS con más recursos puedes subir `MAX_CONCURRENT_JOBS` y `MAX_QUEUE_LENGTH`.

### La app se instala pero no veo tráfico HTTPS

- Instala y confía en el certificado CA de mitmproxy en el dispositivo.
- En Android 7+, las apps solo confían en CAs de usuario si su network security config lo permite; la APK parcheada ya lo configura.
- Comprueba que el proxy del dispositivo apunta a mitmproxy y que el tráfico pasa por él.
- Si la app usa pinning nativo (NDK), Play Integrity, comprobaciones de integridad o attesters, apk-mitm puede no ser suficiente.
- Algunas apps solo permiten tráfico si la firma coincide con la original; en ese caso necesitarías un enfoque diferente (Frida, parcheo nativo, etc.).

### Error al instalar un XAPK/APKS

Usa SAI o:

```bash
adb install-multiple *.apk
```

Si la firma no coincide con la app instalada, desinstala la original primero (perderás sus datos).

### Me echa del login al reiniciar el contenedor

Configura un `SESSION_SECRET` fijo y largo. Si está vacío, el servidor genera uno nuevo en cada arranque y las cookies anteriores dejan de ser válidas.

### El healthcheck está en `unhealthy`

```bash
docker compose logs -f app
curl -v http://127.0.0.1:3000/api/health
```

Comprueba que el contenedor tiene `/data` escribible, que el puerto no está ocupado y que el build del frontend existe en `apps/web/dist`.

---

## Desarrollo local (opcional)

Docker es la forma recomendada. Para desarrollar sin Docker necesitas Node.js 22+ y Java 17.

```bash
pnpm install
```

Configura las variables en tu shell. En Linux/macOS:

```bash
export APP_PASSWORD=dev
export SESSION_SECRET=$(openssl rand -hex 32)
pnpm dev
```

En PowerShell:

```powershell
$env:APP_PASSWORD="dev"
$env:SESSION_SECRET="un-secreto-de-desarrollo"
pnpm dev
```

- API: `http://localhost:3000`
- Web con Vite: `http://localhost:5173` (proxy `/api` hacia el 3000)

Para producción:

```bash
pnpm build
pnpm start
```

El servidor Express sirve `apps/web/dist` automáticamente.

---

## API

Todas las rutas de trabajos requieren la cookie de sesión si `APP_PASSWORD` está configurado.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/health` | Estado del servicio y contadores de trabajos. |
| `GET` | `/api/config` | Configuración pública (límites, versión, si hay login). |
| `GET` | `/api/auth/me` | Estado de autenticación. |
| `POST` | `/api/auth/login` | Body `{ "password": "..." }`. Crea la cookie. |
| `POST` | `/api/auth/logout` | Elimina la cookie. |
| `POST` | `/api/jobs` | Body `{ "url": "https://..." }`. Crea un trabajo (202). |
| `GET` | `/api/jobs/:id` | Snapshot del trabajo, incluidos logs. |
| `GET` | `/api/jobs/:id/events` | Stream SSE con `snapshot`, `status`, `log` y `done`. |
| `POST` | `/api/jobs/:id/cancel` | Cancela un trabajo en curso o en cola. |
| `DELETE` | `/api/jobs/:id` | Elimina un trabajo terminado y sus archivos. |
| `GET` | `/api/jobs/:id/download` | Descarga el archivo preparado. |

Ejemplo:

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"tu-contraseña"}'

curl -b cookies.txt -X POST http://localhost:3000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://ejemplo.com/app.apk"}'
```

---

## Estructura del proyecto

```text
.
├── apps
│   ├── api
│   │   ├── src
│   │   │   ├── auth.ts
│   │   │   ├── config.ts
│   │   │   ├── index.ts
│   │   │   ├── jobs
│   │   │   │   ├── Job.ts
│   │   │   │   ├── JobManager.ts
│   │   │   │   └── pipeline.ts
│   │   │   ├── lib
│   │   │   │   ├── download.ts
│   │   │   │   ├── errors.ts
│   │   │   │   ├── inspect.ts
│   │   │   │   ├── patch.ts
│   │   │   │   └── utils.ts
│   │   │   ├── routes
│   │   │   │   ├── auth.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── jobs.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web
│       ├── public
│       ├── src
│       │   ├── components
│       │   ├── hooks
│       │   ├── lib
│       │   ├── App.tsx
│       │   ├── index.css
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## Limitaciones conocidas

- No evita pinning nativo en librerías NDK, Play Integrity, SafetyNet, attestation ni comprobaciones de firma/integridad.
- La APK resultante usa una firma de depuración distinta de la original.
- No se admiten URLs que requieran cookies, sesión, Referer especial o captchas.
- Los trabajos no se reanudan si el contenedor se reinicia; se limpian al arrancar.
- El diseño es para una sola instancia. Varias réplicas compartiendo `DATA_DIR` no están soportadas.
- Los APKS deben seguir la estructura que espera apk-mitm (`base.apk`).
- El enlace de descarga caduca según `JOB_TTL_MIN` y el archivo se borra del servidor.
- No es un sandbox de malware ni un servicio de análisis de seguridad.

---

## Créditos

- [apk-mitm](https://github.com/niklashigi/apk-mitm) — MIT
- [apktool](https://apktool.org) — Apache License 2.0
- [uber-apk-signer](https://github.com/patrickfav/uber-apk-signer) — Apache License 2.0
- [React](https://react.dev), [Vite](https://vite.dev), [Tailwind CSS](https://tailwindcss.com), [Express](https://expressjs.com)

Añade el archivo de licencia que prefieras antes de publicar el proyecto.
