import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type {
  ConnectionState,
  JobLog,
  JobSnapshot,
  JobStatus,
} from '../types';

const TERMINAL_STATUSES: JobStatus[] = [
  'completed',
  'failed',
  'cancelled',
  'expired',
];

function isTerminal(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function useJob(jobId: string | null, initialJob?: JobSnapshot | null) {
  const [job, setJob] = useState<JobSnapshot | null>(initialJob ?? null);
  const [logs, setLogs] = useState<JobLog[]>(initialJob?.logs ?? []);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const pollTimer = useRef<number | null>(null);
  const eventSource = useRef<EventSource | null>(null);

  const applySnapshot = useCallback((snapshot: JobSnapshot) => {
    setJob(snapshot);
    if (snapshot.logs) setLogs(snapshot.logs);
  }, []);

  const appendLog = useCallback((entry: JobLog) => {
    setLogs((current) => {
      const next = [...current, entry];
      return next.length > 2000 ? next.slice(-2000) : next;
    });
  }, []);

  useEffect(() => {
    setJob(initialJob ?? null);
    setLogs(initialJob?.logs ?? []);
    setConnection(jobId ? 'connecting' : 'closed');

    if (!jobId) return;

    if (pollTimer.current) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }

    const source = new EventSource(`/api/jobs/${jobId}/events`);
    eventSource.current = source;
    let closed = false;
    let polling = false;
    let pollGeneration = 0;
    let sseFallbackTimer: number | null = null;

    const closeSource = () => {
      closed = true;
      source.close();
      if (eventSource.current === source) eventSource.current = null;
    };

    const stopPolling = () => {
      polling = false;
      pollGeneration += 1;
      if (pollTimer.current) {
        window.clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };

    const startPolling = () => {
      if (closed || polling) return;
      polling = true;
      const generation = ++pollGeneration;

      const tick = async () => {
        pollTimer.current = null;
        if (closed || generation !== pollGeneration) return;

        try {
          const snapshot = await api.getJob(jobId);
          if (closed || generation !== pollGeneration) return;

          applySnapshot(snapshot);

          if (!isTerminal(snapshot.status)) {
            pollTimer.current = window.setTimeout(tick, 3000);
          } else {
            polling = false;
            setConnection('closed');
            closeSource();
          }
        } catch (error) {
          if (closed || generation !== pollGeneration) return;

          if (
            error instanceof ApiError &&
            (error.status === 401 || error.status === 404)
          ) {
            polling = false;
            setConnection('closed');
            closeSource();
            return;
          }

          pollTimer.current = window.setTimeout(tick, 5000);
        }
      };

      void tick();
    };

    // Si el proxy no deja abrir SSE, el polling de respaldo arranca igualmente.
    sseFallbackTimer = window.setTimeout(() => {
      sseFallbackTimer = null;
      if (closed || source.readyState === EventSource.OPEN) return;
      setConnection('reconnecting');
      startPolling();
    }, 8000);

    source.addEventListener('open', () => {
      if (sseFallbackTimer) {
        window.clearTimeout(sseFallbackTimer);
        sseFallbackTimer = null;
      }
      stopPolling();
      setConnection('live');
    });

    source.addEventListener('snapshot', (event) => {
      try {
        const snapshot = JSON.parse((event as MessageEvent).data) as JobSnapshot;
        applySnapshot(snapshot);

        if (isTerminal(snapshot.status)) {
          stopPolling();
          setConnection('closed');
          closeSource();
        } else {
          setConnection('live');
        }
      } catch {
        // Ignore malformed events and keep the connection alive.
      }
    });

    source.addEventListener('log', (event) => {
      try {
        appendLog(JSON.parse((event as MessageEvent).data) as JobLog);
      } catch {
        // Ignore malformed log lines.
      }
    });

    source.addEventListener('status', (event) => {
      try {
        const update = JSON.parse((event as MessageEvent).data) as Partial<JobSnapshot>;
        setJob((current) => (current ? { ...current, ...update } : current));
      } catch {
        // Ignore malformed status updates.
      }
    });

    source.addEventListener('done', (event) => {
      try {
        const snapshot = JSON.parse((event as MessageEvent).data) as JobSnapshot;
        applySnapshot(snapshot);
        stopPolling();
        setConnection('closed');
        closeSource();
      } catch {
        // Ignore malformed completion events.
      }
    });

    source.onerror = () => {
      if (closed) return;

      setConnection('reconnecting');

      if (source.readyState === EventSource.CLOSED) {
        startPolling();
        return;
      }

      // La reconexión automática de EventSource puede quedarse colgada
      // detrás de algunos proxies. Si no vuelve a abrir, usamos polling.
      if (!sseFallbackTimer) {
        sseFallbackTimer = window.setTimeout(() => {
          sseFallbackTimer = null;
          if (closed || source.readyState === EventSource.OPEN) return;
          startPolling();
        }, 8000);
      }
    };

    return () => {
      if (sseFallbackTimer) {
        window.clearTimeout(sseFallbackTimer);
        sseFallbackTimer = null;
      }
      stopPolling();
      closeSource();
    };
  }, [jobId, initialJob, applySnapshot, appendLog]);

  return { job, logs, connection };
}
