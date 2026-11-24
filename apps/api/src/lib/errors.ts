import type { JobErrorPayload } from '../types.js';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly hint?: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class PatchError extends AppError {
  constructor(message: string, hint?: string, detail?: string) {
    super('PATCH_FAILED', 422, message, hint, detail);
    this.name = 'PatchError';
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.message === 'ABORTED' ||
      error.message === 'The operation was aborted.')
  );
}

export function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  const error = new Error('ABORTED');
  error.name = 'AbortError';
  throw error;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  if (error === undefined || error === null) return 'Error desconocido';

  try {
    const text = JSON.stringify(error);
    return text ?? String(error);
  } catch {
    return 'Error desconocido';
  }
}

export function toJobError(error: unknown): JobErrorPayload {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      hint: error.hint,
      detail: error.detail,
    };
  }

  if (isAbortError(error)) {
    return {
      code: 'CANCELLED',
      message: 'El trabajo fue cancelado.',
    };
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code);

    if (code === 'ENOSPC') {
      return {
        code: 'DISK_FULL',
        message: 'No hay espacio suficiente en el servidor.',
        hint: 'Libera espacio o aumenta el disco de la VPS.',
      };
    }

    if (code === 'ENOENT') {
      return {
        code: 'FILE_NOT_FOUND',
        message: 'No se encontró un archivo necesario para procesar el APK.',
        hint: 'Revisa los logs del contenedor.',
      };
    }
  }

  return {
    code: 'INTERNAL',
    message: 'Ocurrió un error inesperado.',
    hint: 'Revisa los logs del servidor con docker compose logs -f app.',
    detail: errorText(error).slice(0, 4000),
  };
}

export function apiErrorBody(error: unknown): {
  status: number;
  body: { error: { code: string; message: string; hint?: string } };
} {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          hint: error.hint,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL',
        message: 'Error interno del servidor.',
        hint: 'Revisa los logs del contenedor.',
      },
    },
  };
}
