import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ipaddr from 'ipaddr.js';
import { AppError, isAbortError } from './errors.js';
import { formatBytes, sanitizeFilename } from './utils.js';

export interface DownloadOptions {
  url: string;
  destDir: string;
  signal: AbortSignal;
  maxBytes: number;
  allowPrivateUrls: boolean;
  allowedPorts: Set<number>;
  onProgress?: (received: number, total: number | null) => void;
  timeoutMs?: number;
}

export interface DownloadResult {
  path: string;
  filename: string;
  size: number;
  contentType: string | null;
}

interface TargetOptions {
  allowPrivateUrls: boolean;
  allowedPorts: Set<number>;
}

interface ResolvedTarget {
  address: string;
  family: 4 | 6;
}

const MAX_REDIRECTS = 5;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 APK-HTTPS-Lab/1.0';

const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept:
    'application/vnd.android.package-archive,application/octet-stream,application/zip,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

function stripBrackets(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '');
}

function portOf(url: URL): number {
  if (url.port) return Number.parseInt(url.port, 10);
  return url.protocol === 'https:' ? 443 : 80;
}

export function parseTargetUrl(raw: string): URL {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new AppError('INVALID_URL', 400, 'El enlace no es una URL válida.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError(
      'INVALID_URL',
      400,
      'Solo se permiten enlaces HTTP o HTTPS.',
    );
  }

  if (url.username || url.password) {
    throw new AppError(
      'INVALID_URL',
      400,
      'El enlace no puede incluir usuario o contraseña.',
    );
  }

  if (!url.hostname) {
    throw new AppError('INVALID_URL', 400, 'El enlace no tiene un host válido.');
  }

  return url;
}

type ParsedAddress = ReturnType<typeof ipaddr.process>;

// Rangos que nunca deben ser alcanzables desde el descargador, ni siquiera
// cuando ALLOW_PRIVATE_URLS está activo. Incluye rangos especiales que no son
// enrutables en Internet y que ipaddr.js clasifica aparte de "unicast".
const ALWAYS_BLOCKED_RANGES = new Set<string>([
  'unspecified',
  'multicast',
  'broadcast',
  'linkLocal',
  'reserved',
  'benchmarking',
  'amt',
  'as112',
  'as112v6',
  'orchid2',
  'droneRemoteIdProtocolEntityTags',
  'ipv4Mapped',
  'rfc6145',
  'rfc6052',
  '6to4',
  'teredo',
]);

const PRIVATE_RANGES = new Set<string>([
  'private',
  'loopback',
  'carrierGradeNat',
  'uniqueLocal',
]);

function isBlockedIp(address: string, allowPrivateUrls: boolean): boolean {
  let parsed: ParsedAddress;

  try {
    parsed = ipaddr.process(address);
  } catch {
    return true;
  }

  const range: string = parsed.range();

  if (ALWAYS_BLOCKED_RANGES.has(range)) return true;
  if (range === 'unicast') return false;

  // Solo se permiten rangos privados conocidos cuando el operador lo habilita.
  // Cualquier rango nuevo o desconocido se bloquea por defecto.
  return !allowPrivateUrls || !PRIVATE_RANGES.has(range);
}

async function resolveTarget(url: URL, options: TargetOptions): Promise<ResolvedTarget> {
  const port = portOf(url);

  if (!options.allowedPorts.has(port)) {
    throw new AppError(
      'PORT_NOT_ALLOWED',
      400,
      `El puerto ${port} no está permitido.`,
      'Por seguridad solo se permiten los puertos configurados en ALLOWED_PORTS.',
    );
  }

  const host = stripBrackets(url.hostname);
  let addresses: Array<{ address: string; family: number }>;

  if (ipaddr.isValid(host)) {
    const parsed = ipaddr.parse(host);
    addresses = [
      {
        address: parsed.toString(),
        family: parsed.kind() === 'ipv4' ? 4 : 6,
      },
    ];
  } else {
    try {
      addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new AppError(
        'DNS_FAILED',
        400,
        `No se pudo resolver el host ${host}.`,
        'Comprueba que el dominio exista y que el enlace sea correcto.',
      );
    }
  }

  if (addresses.length === 0) {
    throw new AppError('DNS_FAILED', 400, 'El dominio no tiene direcciones IP.');
  }

  for (const entry of addresses) {
    if (isBlockedIp(entry.address, options.allowPrivateUrls)) {
      throw new AppError(
        'BLOCKED_URL',
        400,
        'El enlace apunta a una dirección privada o no permitida.',
        'Por seguridad solo se permiten destinos públicos. Si necesitas una URL privada, activa ALLOW_PRIVATE_URLS.',
      );
    }
  }

  // Prefer IPv4 when both families are available.
  addresses.sort((a, b) => a.family - b.family);
  const chosen = addresses[0];

  return {
    address: chosen.address,
    family: chosen.family === 6 ? 6 : 4,
  };
}

export async function validateTargetUrl(raw: string, options: TargetOptions): Promise<URL> {
  const url = parseTargetUrl(raw);
  await resolveTarget(url, options);
  return url;
}

function requestOnce(
  url: URL,
  target: ResolvedTarget,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const host = stripBrackets(url.hostname);

    const baseOptions: http.RequestOptions = {
      hostname: host,
      port: portOf(url),
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: REQUEST_HEADERS,
      lookup: (_hostname, _options, callback) => {
        callback(null, target.address, target.family);
      },
      signal,
    };

    const req = isHttps
      ? https.request(
          {
            ...baseOptions,
            servername: ipaddr.isValid(host) ? undefined : host,
          },
          resolve,
        )
      : http.request(baseOptions, resolve);

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('DOWNLOAD_TIMEOUT'));
    });
    req.on('error', reject);
    req.end();
  });
}

function filenameFromUrl(url: URL): string {
  try {
    const decoded = decodeURIComponent(path.basename(url.pathname));
    return decoded && decoded !== '/' ? decoded : 'apk-download';
  } catch {
    return 'apk-download';
  }
}

function filenameFromDisposition(header: string): string | null {
  const extended = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(header);
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return extended[1].trim().replace(/^"|"$/g, '');
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

function extensionFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.apk' || ext === '.xapk' || ext === '.apks' || ext === '.zip') {
    return ext;
  }
  return '.bin';
}

export async function downloadFile(options: DownloadOptions): Promise<DownloadResult> {
  let current = parseTargetUrl(options.url);
  let filename = filenameFromUrl(current);
  let contentType: string | null = null;
  const timeoutMs = options.timeoutMs ?? 120_000;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (options.signal.aborted) {
      const error = new Error('ABORTED');
      error.name = 'AbortError';
      throw error;
    }

    const target = await resolveTarget(current, options);
    let response: http.IncomingMessage;

    try {
      response = await requestOnce(current, target, options.signal, timeoutMs);
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof Error && error.message === 'DOWNLOAD_TIMEOUT') {
        throw new AppError(
          'DOWNLOAD_TIMEOUT',
          504,
          'La descarga tardó demasiado.',
          'El servidor de origen no respondió a tiempo.',
        );
      }
      throw new AppError(
        'DOWNLOAD_FAILED',
        502,
        'No se pudo conectar con el servidor de descarga.',
        'Comprueba que el enlace sea directo y esté disponible públicamente.',
      );
    }

    const status = response.statusCode ?? 0;

    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.location;
      response.resume();

      if (!location) {
        throw new AppError(
          'DOWNLOAD_FAILED',
          502,
          'El servidor devolvió una redirección sin destino.',
        );
      }

      if (redirects === MAX_REDIRECTS) {
        throw new AppError(
          'TOO_MANY_REDIRECTS',
          400,
          'El enlace redirige demasiadas veces.',
        );
      }

      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new AppError(
          'DOWNLOAD_FAILED',
          502,
          'El servidor devolvió una redirección inválida.',
        );
      }

      current = parseTargetUrl(next.toString());
      const nextFilename = filenameFromUrl(current);
      if (nextFilename !== 'apk-download') filename = nextFilename;
      continue;
    }

    if (status < 200 || status >= 300) {
      response.resume();
      throw new AppError(
        `HTTP_${status}`,
        502,
        `El servidor de descarga respondió con HTTP ${status}.`,
        status === 403
          ? 'El enlace puede requerir cookies, una sesión o estar bloqueado para el servidor.'
          : undefined,
      );
    }

    const responseType = response.headers['content-type'];
    if (typeof responseType === 'string') contentType = responseType;

    const disposition = response.headers['content-disposition'];
    if (typeof disposition === 'string') {
      const fromHeader = filenameFromDisposition(disposition);
      if (fromHeader) filename = fromHeader;
    }

    filename = sanitizeFilename(filename, 'apk-download');

    const totalHeader = response.headers['content-length'];
    const total = totalHeader ? Number.parseInt(totalHeader, 10) : null;

    if (total !== null && Number.isFinite(total) && total > options.maxBytes) {
      response.destroy();
      throw new AppError(
        'TOO_LARGE',
        413,
        `El archivo supera el límite de ${formatBytes(options.maxBytes)}.`,
        'Aumenta MAX_APK_MB o usa un archivo más pequeño.',
      );
    }

    const partPath = path.join(options.destDir, `download-${Date.now()}.part`);
    let received = 0;

    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;

        if (received > options.maxBytes) {
          callback(
            new AppError(
              'TOO_LARGE',
              413,
              `El archivo supera el límite de ${formatBytes(options.maxBytes)}.`,
              'Aumenta MAX_APK_MB o usa un archivo más pequeño.',
            ),
          );
          return;
        }

        options.onProgress?.(received, total);
        callback(null, chunk);
      },
    });

    try {
      await pipeline(response, limiter, createWriteStream(partPath));
    } catch (error) {
      await fs.rm(partPath, { force: true }).catch(() => undefined);

      if (isAbortError(error)) throw error;
      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.message === 'DOWNLOAD_TIMEOUT') {
        throw new AppError(
          'DOWNLOAD_TIMEOUT',
          504,
          'La descarga tardó demasiado.',
          'El servidor de origen dejó de enviar datos a tiempo.',
        );
      }

      throw new AppError(
        'DOWNLOAD_FAILED',
        502,
        'La descarga se interrumpió antes de terminar.',
        'Vuelve a intentarlo o usa otro enlace directo.',
      );
    }

    const finalPath = path.join(
      options.destDir,
      `download-${Date.now()}${extensionFromFilename(filename)}`,
    );
    await fs.rename(partPath, finalPath);

    const stat = await fs.stat(finalPath);
    if (stat.size === 0) {
      await fs.rm(finalPath, { force: true }).catch(() => undefined);
      throw new AppError('EMPTY_FILE', 422, 'El archivo descargado está vacío.');
    }

    options.onProgress?.(stat.size, stat.size);

    return {
      path: finalPath,
      filename,
      size: stat.size,
      contentType,
    };
  }

  throw new AppError(
    'TOO_MANY_REDIRECTS',
    400,
    'El enlace redirige demasiadas veces.',
  );
}
