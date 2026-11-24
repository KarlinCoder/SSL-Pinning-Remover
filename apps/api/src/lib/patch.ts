import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { Job } from '../jobs/Job.js';
import type { JobPhase } from '../types.js';
import { AppError, PatchError, isAbortError, throwIfAborted } from './errors.js';
import { detectPackageKind } from './inspect.js';
import { cleanLogMessage } from './utils.js';

const require = createRequire(import.meta.url);

interface PhaseUpdate {
  phase: JobPhase;
  progress: number;
}

function resolveApkMitmBin(): string {
  let entry: string;

  try {
    entry = require.resolve('apk-mitm');
  } catch {
    throw new AppError(
      'PATCH_ENGINE_MISSING',
      500,
      'No se encontró el motor apk-mitm en el servidor.',
      'Revisa que la imagen Docker se construyera correctamente.',
    );
  }

  return path.join(path.dirname(entry), '..', 'bin', 'apk-mitm');
}

async function existingFile(filePath: string): Promise<string | undefined> {
  if (!filePath) return undefined;

  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return undefined;
  }
}

function phaseForLine(line: string): PhaseUpdate | null {
  const rules: Array<[RegExp, JobPhase, number]> = [
    [/Extracting APKs/i, 'decode', 20],
    [/Finding base APK path/i, 'decode', 22],
    [/Downloading (apktool|uber-apk-signer)/i, 'decode', 22],
    [/Decoding APK file|Patching base APK/i, 'decode', 30],
    [/Applying patches/i, 'pinning', 45],
    [/Modifying app manifest/i, 'manifest', 50],
    [/Replacing network security config/i, 'network-config', 58],
    [/Disabling certificate pinning/i, 'pinning', 66],
    [/Encoding patched APK file|Encoding using AAPT/i, 'build', 78],
    [/Signing patched APK file|Signing APKs/i, 'sign', 90],
    [/Compressing APKs/i, 'package', 96],
    [/Done!/i, 'done', 99],
  ];

  for (const [pattern, phase, progress] of rules) {
    if (pattern.test(line)) return { phase, progress };
  }

  return null;
}

function levelForLine(line: string): 'info' | 'warn' | 'error' | 'success' | 'debug' {
  if (/^\s*W:|warning/i.test(line)) return 'warn';
  if (/error|failed|exception|fatal/i.test(line)) return 'error';
  if (/Done!|successfully|patched file/i.test(line)) return 'success';
  return 'info';
}

async function findOutput(job: Job, inputPath: string): Promise<string> {
  const ext = path.extname(inputPath);
  const expected = path.join(job.jobDir, `input-patched${ext}`);

  try {
    await fs.access(expected);
    return expected;
  } catch {
    // Fall through to a directory scan.
  }

  const entries = await fs.readdir(job.jobDir, { withFileTypes: true });
  const candidates: Array<{ path: string; mtime: number }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.includes('-patched.')) continue;

    const candidatePath = path.join(job.jobDir, entry.name);
    const stat = await fs.stat(candidatePath);
    candidates.push({ path: candidatePath, mtime: stat.mtimeMs });
  }

  candidates.sort((a, b) => b.mtime - a.mtime);

  if (candidates[0]) return candidates[0].path;

  throw new PatchError(
    'apk-mitm terminó sin generar un archivo de salida.',
    'Revisa los logs. Puede que apktool no haya podido recompilar esta APK.',
    job.recentLogText(120),
  );
}

async function runApkMitm(job: Job, apktoolJar?: string): Promise<string> {
  const inputPath = job.inputPath;
  if (!inputPath) {
    throw new AppError('INTERNAL', 500, 'No hay archivo de entrada para parchear.');
  }

  throwIfAborted(job.signal);

  const binPath = resolveApkMitmBin();
  const tmpDir = path.join(job.jobDir, 'tmp');
  const ext = path.extname(inputPath);
  const expectedOutput = path.join(job.jobDir, `input-patched${ext}`);

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  await fs.rm(expectedOutput, { force: true }).catch(() => undefined);

  const args = [binPath, inputPath, '--tmp-dir', tmpDir, '--keep-tmp-dir'];

  if (apktoolJar) {
    args.push('--apktool', apktoolJar);
  }

  if (config.makeDebuggable) {
    args.push('--debuggable');
  }

  if (config.extraCaPath) {
    const extension = path.extname(config.extraCaPath).toLowerCase();
    if (extension === '.pem' || extension === '.der') {
      if (await existingFile(config.extraCaPath)) {
        args.push('--certificate', config.extraCaPath);
      } else {
        job.log('warn', `No se encontró el certificado EXTRA_CA_PATH: ${config.extraCaPath}`);
      }
    }
  }

  job.log(
    'info',
    `Ejecutando apk-mitm con apktool ${apktoolJar ? path.basename(apktoolJar) : 'por defecto'}...`,
  );

  const env = {
    ...process.env,
    JAVA_TOOL_OPTIONS:
      process.env.JAVA_TOOL_OPTIONS || `-Xmx${config.javaMaxHeapMb}m`,
  };

  const child = spawn(process.execPath, args, {
    cwd: job.jobDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });

  job.attachChild(child);

  let stdoutBuffer = '';
  let stderrBuffer = '';

  const handleLine = (rawLine: string): void => {
    const line = cleanLogMessage(rawLine);
    if (!line) return;
    if (line.includes('Picked up JAVA_TOOL_OPTIONS')) return;

    job.log(levelForLine(line), line);
    const update = phaseForLine(line);
    if (update) job.setPhase(update.phase, update.progress);
  };

  const consume = (chunk: Buffer, stream: 'stdout' | 'stderr'): void => {
    if (stream === 'stdout') {
      stdoutBuffer += chunk.toString('utf8');
      const parts = stdoutBuffer.split(/\r\n|\n|\r/);
      stdoutBuffer = parts.pop() ?? '';
      for (const line of parts) handleLine(line);
      return;
    }

    stderrBuffer += chunk.toString('utf8');
    const parts = stderrBuffer.split(/\r\n|\n|\r/);
    stderrBuffer = parts.pop() ?? '';
    for (const line of parts) handleLine(line);
  };

  child.stdout?.on('data', (chunk: Buffer) => consume(chunk, 'stdout'));
  child.stderr?.on('data', (chunk: Buffer) => consume(chunk, 'stderr'));

  let exitCode: number | null;

  try {
    exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code) => resolve(code));
    });
  } catch (error) {
    job.clearChild();
    if (isAbortError(error)) throw error;
    throw new AppError(
      'PATCH_ENGINE_ERROR',
      500,
      'No se pudo iniciar apk-mitm.',
      'Comprueba que Java y las dependencias estén instalados en el contenedor.',
    );
  }

  if (stdoutBuffer) handleLine(stdoutBuffer);
  if (stderrBuffer) handleLine(stderrBuffer);

  job.clearChild();
  throwIfAborted(job.signal);

  if (exitCode !== 0) {
    throw new PatchError(
      'apk-mitm no pudo preparar la APK.',
      'La APK puede estar protegida, usar un formato no soportado o necesitar otra versión de apktool.',
      job.recentLogText(140),
    );
  }

  const outputPath = await findOutput(job, inputPath);

  try {
    await detectPackageKind(outputPath);
  } catch {
    throw new PatchError(
      'El archivo generado no es una APK, XAPK o APKS válida.',
      'Revisa los logs de apk-mitm para ver si la recompilación falló.',
      job.recentLogText(140),
    );
  }

  return outputPath;
}

function isApktoolFailure(error: unknown): boolean {
  if (!(error instanceof PatchError)) return false;
  const text = `${error.message}\n${error.detail ?? ''}`;
  return /brut\.|AndrolibException|Could not decode|failed to decode|apktool.*(error|fail)|Unrecognized option|Unknown option|--frame-path|--use-aapt2|Exception in thread/i.test(
    text,
  );
}

export async function prepareApk(job: Job): Promise<string> {
  const primary = await existingFile(config.apktoolJar);
  const fallback = await existingFile(config.apktoolFallbackJar);

  if (config.apktoolJar && !primary) {
    job.log('warn', `No se encontró APKTOOL_JAR: ${config.apktoolJar}. Se usará el apktool por defecto de apk-mitm.`);
  }

  if (config.apktoolFallbackJar && !fallback) {
    job.log('warn', `No se encontró APKTOOL_FALLBACK_JAR: ${config.apktoolFallbackJar}.`);
  }

  if (primary) {
    try {
      return await runApkMitm(job, primary);
    } catch (error) {
      if (!isApktoolFailure(error) || !fallback || fallback === primary) {
        throw error;
      }

      job.log(
        'warn',
        'El primer intento con apktool falló. Reintentando con la versión de respaldo...',
      );
      return runApkMitm(job, fallback);
    }
  }

  if (fallback) {
    try {
      return await runApkMitm(job, fallback);
    } catch (error) {
      if (!isApktoolFailure(error)) throw error;

      job.log(
        'warn',
        'El intento con el apktool de respaldo falló. Reintentando con el apktool por defecto...',
      );
      return runApkMitm(job);
    }
  }

  return runApkMitm(job);
}
