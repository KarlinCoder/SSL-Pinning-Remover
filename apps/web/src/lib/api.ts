import type { AppConfig, JobSnapshot } from '../types';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly hint?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; hint?: string } } | null)
      ?.error;

    throw new ApiError(
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Error HTTP ${response.status}.`,
      error?.hint,
      response.status,
    );
  }

  return payload as T;
}

export const api = {
  getConfig(): Promise<AppConfig> {
    return request<AppConfig>('/api/config');
  },

  createJob(url: string): Promise<JobSnapshot> {
    return request<JobSnapshot>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  uploadFile(file: File, onProgress?: (percent: number) => void): Promise<JobSnapshot> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', '/api/upload', true);
      xhr.withCredentials = true;

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded * 100) / event.total);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        let payload: any = null;
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          payload = null;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload as JobSnapshot);
        } else {
          const error = payload?.error;
          reject(
            new ApiError(
              error?.code ?? 'HTTP_ERROR',
              error?.message ?? `Error HTTP ${xhr.status}.`,
              error?.hint,
              xhr.status,
            ),
          );
        }
      };

      xhr.onerror = () => {
        reject(new ApiError('NETWORK_ERROR', 'Error de red al subir el archivo.'));
      };

      xhr.send(formData);
    });
  },

  getJob(id: string): Promise<JobSnapshot> {
    return request<JobSnapshot>(`/api/jobs/${id}`);
  },

  cancelJob(id: string): Promise<{ ok: true; job: JobSnapshot }> {
    return request<{ ok: true; job: JobSnapshot }>(`/api/jobs/${id}/cancel`, {
      method: 'POST',
    });
  },

  deleteJob(id: string): Promise<void> {
    return request<void>(`/api/jobs/${id}`, { method: 'DELETE' });
  },
};
