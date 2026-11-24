import { promises as fs } from 'node:fs';
import * as yauzl from 'yauzl';
import type { PackageKind } from '../types.js';
import { AppError } from './errors.js';

const MAX_ENTRIES = 100_000;

async function looksLikeZip(filePath: string): Promise<boolean> {
  const handle = await fs.open(filePath, 'r');

  try {
    const buffer = Buffer.alloc(4);
    const { bytesRead } = await handle.read(buffer, 0, 4, 0);
    return bytesRead === 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  } finally {
    await handle.close();
  }
}

function listEntries(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      { lazyEntries: true, autoClose: true },
      (openError, zipFile) => {
        if (openError || !zipFile) {
          reject(
            new AppError(
              'UNSUPPORTED_FILE',
              422,
              'El archivo no es un ZIP/APK válido.',
              'El enlace debe apuntar directamente al archivo APK, XAPK o APKS.',
            ),
          );
          return;
        }

        const entries: string[] = [];
        let settled = false;

        const finish = (callback: () => void): void => {
          if (settled) return;
          settled = true;
          callback();
        };

        zipFile.on('entry', (entry) => {
          entries.push(entry.fileName);

          if (entries.length > MAX_ENTRIES) {
            finish(() => {
              try {
                zipFile.close();
              } catch {
                // Ignore close errors.
              }
              reject(
                new AppError(
                  'UNSUPPORTED_FILE',
                  422,
                  'El archivo contiene demasiadas entradas.',
                ),
              );
            });
            return;
          }

          zipFile.readEntry();
        });

        zipFile.on('end', () => {
          finish(() => resolve(entries));
        });

        zipFile.on('error', () => {
          finish(() =>
            reject(
              new AppError(
                'UNSUPPORTED_FILE',
                422,
                'No se pudo leer el archivo como ZIP.',
                'Puede estar corrupto o protegido con contraseña.',
              ),
            ),
          );
        });

        zipFile.readEntry();
      },
    );
  });
}

export async function detectPackageKind(filePath: string): Promise<PackageKind> {
  if (!(await looksLikeZip(filePath))) {
    throw new AppError(
      'UNSUPPORTED_FILE',
      422,
      'El archivo no parece una APK, XAPK o APKS válida.',
      'Comprueba que el enlace sea directo al archivo y no a una página HTML.',
    );
  }

  const entries = await listEntries(filePath);
  const names = entries.map((entry) =>
    entry.replace(/\\/g, '/').replace(/^\.?\//, ''),
  );

  if (names.includes('AndroidManifest.xml')) {
    return 'apk';
  }

  const apkEntries = names.filter((name) => /\.apk$/i.test(name));
  const hasXapkManifest = names.includes('manifest.json');

  if (hasXapkManifest && apkEntries.length > 0) {
    return 'xapk';
  }

  if (
    apkEntries.some((name) => /(^|\/)base(-[^/]+)?\.apk$/i.test(name)) ||
    apkEntries.length > 0
  ) {
    return 'apks';
  }

  throw new AppError(
    'UNSUPPORTED_FILE',
    422,
    'El archivo no contiene una APK reconocible.',
    'Se esperaba un APK, un XAPK de APKPure o un APKS de SAI.',
  );
}
