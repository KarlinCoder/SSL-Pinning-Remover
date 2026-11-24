import type { AppConfig, AuthState, JobSnapshot } from '../types';

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
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('apk-lab:unauthorized'));
    }

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

  getAuthState(): Promise<AuthState> {
    return request<AuthState>('/api/auth/me');
  },

  login(password: string): Promise<AuthState> {
    return request<AuthState>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  logout(): Promise<{ ok: true }> {
    return request<{ ok: true }>('/api/auth/logout', { method: 'POST' });
  },

  createJob(url: string): Promise<JobSnapshot> {
    return request<JobSnapshot>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ url }),
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
