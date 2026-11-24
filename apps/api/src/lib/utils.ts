import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import stripAnsi from 'strip-ansi';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function sanitizeFilename(name: string, fallback = 'archivo'): string {
  const base = path.basename(name || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  const safe = base.replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 120);
  return safe || fallback;
}

export function cleanLogMessage(message: string): string {
  return stripAnsi(message)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+$/g, '')
    .slice(0, 4000);
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function hasEnoughDiskSpace(dir: string, requiredBytes: number): Promise<boolean> {
  try {
    const stats = await fs.statfs(dir);
    const free = Number(stats.bavail) * Number(stats.bsize);
    return free > requiredBytes;
  } catch {
    return true;
  }
}

export function killProcessTree(child: ChildProcess): void {
  if (!child.pid) return;

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // The process may have already exited.
    }
  }
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n… (truncado)`;
}
