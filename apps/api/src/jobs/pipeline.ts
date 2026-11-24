import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { Job } from '../jobs/Job.js';
import type { PackageKind } from '../types.js';
import { downloadFile } from '../lib/download.js';
import { detectPackageKind } from '../lib/inspect.js';
import { prepareApk } from '../lib/patch.js';
import { AppError, throwIfAborted } from '../lib/errors.js';
import {
  formatBytes,
  hasEnoughDiskSpace,
  sanitizeFilename,
  sha256File,
} from '../lib/utils.js';

function outputFilename(sourceFilename: string | undefined, kind: PackageKind): string {
  const original = sourceFilename || 'apk';
  const base = path.basename(original, path.extname(original));
  const safeBase =
    sanitizeFilename(base, 'apk')
      .replace(/[. ]+$/g, '')
      .slice(0, 80) || 'apk';

  return `${safeBase}-https-inspection.${kind}`;
}

export async function runJob(job: Job): Promise<void> {
  await fs.mkdir(job.jobDir, { recursive: true });

  job.setStatus('downloading', 'download', 3);
  job.log('info', `Descargando desde ${job.sourceHost}...`);

  let lastProgressAt = 0;

  const download = await downloadFile({
    url: job.inputUrl,
    destDir: job.jobDir,
    signal: job.signal,
    maxBytes: config.maxApkBytes,
    allowPrivateUrls: config.allowPrivateUrls,
    allowedPorts: config.allowedPorts,
    timeoutMs: 120_000,
    onProgress: (received, total) => {
      job.downloadedBytes = received;
      job.totalBytes = total ?? undefined;

      const now = Date.now();
      if (now - lastProgressAt < 500 && received !== total) return;
      lastProgressAt = now;

      const percent = total
        ? 3 + Math.min(14, Math.floor((received / total) * 14))
        : 5;
      job.setStatus('downloading', 'download', percent);
    },
  });

  throwIfAborted(job.signal);

  job.sourceFilename = download.filename;
  job.downloadedBytes = download.size;
  job.totalBytes = download.size;
  job.log(
    'success',
    `Descargado ${download.filename} (${formatBytes(download.size)}).`,
  );

  const requiredDisk = download.size * 5 + 512 * 1024 * 1024;
  if (!(await hasEnoughDiskSpace(job.jobDir, requiredDisk))) {
    throw new AppError(
      'DISK_FULL',
      507,
      'No hay espacio suficiente en el servidor para procesar este archivo.',
      'Libera espacio o aumenta el disco de la VPS. apktool necesita varios GB libres para APKs grandes.',
    );
  }

  job.setStatus('inspecting', 'inspect', 18);
  job.log('info', 'Inspeccionando el contenedor descargado...');

  const kind = await detectPackageKind(download.path);
  const extension = kind === 'apk' ? '.apk' : kind === 'xapk' ? '.xapk' : '.apks';
  const inputPath = path.join(job.jobDir, `input${extension}`);
  await fs.rename(download.path, inputPath);
  job.inputPath = inputPath;

  job.log('success', `Formato detectado: ${kind.toUpperCase()}.`);

  job.setStatus('patching', 'decode', 25);
  job.log('info', 'Iniciando apk-mitm (apktool + uber-apk-signer)...');

  const outputPath = await prepareApk(job);
  throwIfAborted(job.signal);

  job.outputPath = outputPath;
  job.setStatus('packaging', 'package', 96);
  job.log('info', 'Calculando hash y preparando la descarga...');

  const stat = await fs.stat(outputPath);
  if (stat.size === 0) {
    throw new AppError(
      'PATCH_FAILED',
      422,
      'El APK generado está vacío.',
      'Revisa los logs de apk-mitm.',
    );
  }

  const sha256 = await sha256File(outputPath);
  throwIfAborted(job.signal);

  const filename = outputFilename(job.sourceFilename, kind);
  const finalPath = path.join(job.jobDir, filename);

  await fs.rm(finalPath, { force: true }).catch(() => undefined);
  await fs.rename(outputPath, finalPath);
  job.outputPath = finalPath;

  await fs.rm(inputPath, { force: true }).catch(() => undefined);
  await fs.rm(path.join(job.jobDir, 'tmp'), { recursive: true, force: true }).catch(() => undefined);
  await fs
    .rm(path.join(job.jobDir, 'tmp-fallback'), { recursive: true, force: true })
    .catch(() => undefined);

  const expiresAt = new Date(Date.now() + config.jobTtlMs).toISOString();
  throwIfAborted(job.signal);

  job.log('success', 'APK preparada. Lista para descargar.');
  job.complete({
    filename,
    size: stat.size,
    sha256,
    kind,
    downloadUrl: `/api/jobs/${job.id}/download`,
    expiresAt,
  });
}
