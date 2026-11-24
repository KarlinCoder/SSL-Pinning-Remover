import { useEffect, useState, type ReactNode } from 'react';
import { formatBytes, formatDuration, formatShortId } from '../lib/format';
import type { ConnectionState, JobLog, JobSnapshot, JobStatus } from '../types';
import { ConnectionBadge } from './ConnectionBadge';
import {
  ClockIcon,
  FileArchiveIcon,
  HashIcon,
  LoaderIcon,
  RadioIcon,
  ServerIcon,
  XIcon,
} from './Icons';
import { LogConsole } from './LogConsole';
import { Stepper } from './Stepper';

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'En cola',
  downloading: 'Descargando',
  inspecting: 'Inspeccionando',
  patching: 'Parcheando',
  packaging: 'Empaquetando',
  completed: 'Completado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

const TERMINAL: JobStatus[] = ['completed', 'failed', 'cancelled', 'expired'];

interface JobPanelProps {
  job: JobSnapshot;
  logs: JobLog[];
  connection: ConnectionState;
  onCancel: () => Promise<void>;
}

function Meta({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </div>
      <p
        className={`mt-1.5 truncate text-sm text-zinc-200 ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export function JobPanel({ job, logs, connection, onCancel }: JobPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const running = !TERMINAL.includes(job.status);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const startedAt = Date.parse(job.startedAt ?? job.createdAt);
  const finishedAt = job.finishedAt ? Date.parse(job.finishedAt) : now;
  const elapsed = Number.isFinite(startedAt)
    ? Math.max(0, finishedAt - startedAt)
    : 0;

  const sizeLabel = job.downloadedBytes
    ? job.totalBytes && job.totalBytes !== job.downloadedBytes
      ? `${formatBytes(job.downloadedBytes)} / ${formatBytes(job.totalBytes)}`
      : formatBytes(job.downloadedBytes)
    : '—';

  async function handleCancel() {
    if (cancelling) return;

    setCancelling(true);
    setCancelError(null);

    try {
      await onCancel();
    } catch (error) {
      setCancelError(
        error instanceof Error ? error.message : 'No se pudo cancelar el trabajo.',
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-lab-panel/70 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]">
      <div className="border-b border-white/[0.06] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-lab-lime">
              <RadioIcon className="h-3.5 w-3.5" />
              {job.status === 'queued' ? 'En cola' : 'Procesando'}
            </div>
            <h2 className="mt-2 truncate text-xl font-semibold tracking-tight text-white">
              {job.sourceFilename
                ? `Preparando ${job.sourceFilename}`
                : 'Preparando paquete'}
            </h2>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {job.sourceHost} · ID{' '}
              <span className="font-mono">{formatShortId(job.id)}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ConnectionBadge state={connection} />
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling || !running}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-red-400/30 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? (
                <LoaderIcon className="h-3.5 w-3.5" />
              ) : (
                <XIcon className="h-3.5 w-3.5" />
              )}
              {cancelling ? 'Cancelando…' : 'Cancelar'}
            </button>
          </div>
        </div>

        {job.status === 'queued' ? (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <LoaderIcon className="h-4 w-4 shrink-0 text-lab-lime" />
            <p>
              En cola
              {job.queuePosition ? ` — posición #${job.queuePosition}` : ''}. El
              trabajo empezará cuando haya un hueco libre.
            </p>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-zinc-300">
              {STATUS_LABEL[job.status]}
            </span>
            <span className="font-mono text-sm text-lab-lime">{job.progress}%</span>
          </div>
          <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-linear-to-r from-emerald-400 via-lab-lime to-lab-lime-soft transition-[width] duration-500"
              style={{ width: `${Math.max(1.5, job.progress)}%` }}
            />
            {running && job.status !== 'queued' ? (
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-lab-scan bg-linear-to-r from-transparent via-white/30 to-transparent" />
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <Stepper phase={job.phase} status={job.status} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meta
            icon={<ServerIcon className="h-3.5 w-3.5" />}
            label="Origen"
            value={job.sourceHost}
          />
          <Meta
            icon={<FileArchiveIcon className="h-3.5 w-3.5" />}
            label="Tamaño"
            value={sizeLabel}
          />
          <Meta
            icon={<ClockIcon className="h-3.5 w-3.5" />}
            label="Tiempo"
            value={formatDuration(elapsed)}
          />
          <Meta
            icon={<HashIcon className="h-3.5 w-3.5" />}
            label="ID"
            value={formatShortId(job.id)}
            mono
          />
        </div>

        {cancelError ? (
          <p className="mt-3 text-xs text-red-300">{cancelError}</p>
        ) : null}
      </div>

      <div className="p-5 sm:p-6">
        <LogConsole logs={logs} connection={connection} />
      </div>
    </section>
  );
}
