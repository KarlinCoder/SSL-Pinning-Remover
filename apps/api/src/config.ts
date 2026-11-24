import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function envList(name: string, fallback: string[]): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

// `src` en desarrollo y `dist` en producción están al mismo nivel dentro de
// apps/api, así que subir tres niveles llega siempre a la raíz del proyecto.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..', '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(repoRoot, 'data'));

const allowedPorts = new Set(
  envList('ALLOWED_PORTS', ['80', '443'])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 65535),
);

if (allowedPorts.size === 0) {
  allowedPorts.add(80);
  allowedPorts.add(443);
}

export const config = {
  version: '1.0.0',
  port: envInt('PORT', 3000, 1, 65535),
  host: process.env.HOST?.trim() || '0.0.0.0',
  dataDir,
  jobsDir: path.join(dataDir, 'jobs'),
  webDist: path.resolve(
    process.env.WEB_DIST || path.join(repoRoot, 'apps', 'web', 'dist'),
  ),
  authRequired: false,
  sessionSecret: randomBytes(32).toString('hex'),
  generatedSessionSecret: true,
  cookieSecure: false,
  trustProxy: envBool('TRUST_PROXY', false),
  maxApkBytes: envInt('MAX_APK_MB', 1024, 1, 8192) * 1024 * 1024,
  maxConcurrentJobs: envInt('MAX_CONCURRENT_JOBS', 1, 1, 3),
  maxQueueLength: envInt('MAX_QUEUE_LENGTH', 8, 1, 50),
  jobTtlMs: envInt('JOB_TTL_MIN', 60, 1, 1440) * 60_000,
  jobTimeoutMs: envInt('JOB_TIMEOUT_MIN', 45, 1, 240) * 60_000,
  allowPrivateUrls: envBool('ALLOW_PRIVATE_URLS', false),
  allowedPorts,
  apktoolJar: process.env.APKTOOL_JAR?.trim() || '',
  apktoolFallbackJar: process.env.APKTOOL_FALLBACK_JAR?.trim() || '',
  javaMaxHeapMb: envInt('JAVA_MAX_HEAP_MB', 2048, 256, 16384),
  makeDebuggable: envBool('MAKE_DEBUGGABLE', false),
  extraCaPath: process.env.EXTRA_CA_PATH?.trim() || '',
  maxLogLines: envInt('MAX_LOG_LINES', 2000, 100, 10000),
};
