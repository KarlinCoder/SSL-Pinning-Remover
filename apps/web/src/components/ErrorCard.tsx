import type { JobLog, JobSnapshot } from '../types';
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  InfoIcon,
  RefreshCwIcon,
} from './Icons';
import { LogConsole } from './LogConsole';

interface ErrorCardProps {
  job: JobSnapshot;
  logs: JobLog[];
  onReset: () => void;
}

const TONES = {
  error: {
    border: 'border-red-400/25',
    background: 'bg-linear-to-b from-red-400/[0.06] to-lab-panel/80',
    icon: 'border-red-400/30 bg-red-400/10 text-red-300',
    badge: 'border-red-400/25 bg-red-400/10 text-red-300',
    text: 'text-red-200',
    label: 'Error',
  },
  neutral: {
    border: 'border-amber-400/20',
    background: 'bg-linear-to-b from-amber-400/[0.05] to-lab-panel/80',
    icon: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    badge: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    text: 'text-amber-200',
    label: 'Aviso',
  },
} as const;

export function ErrorCard({ job, logs, onReset }: ErrorCardProps) {
  const cancelled = job.status === 'cancelled';
  const expired = job.status === 'expired';
  const tone = cancelled || expired ? TONES.neutral : TONES.error;

  const title = cancelled
    ? 'Trabajo cancelado'
    : expired
      ? 'El enlace de descarga expiró'
      : 'No se pudo preparar la APK';

  const message = cancelled
    ? 'El trabajo se detuvo antes de terminar. No se generó ningún archivo.'
    : expired
      ? 'El archivo ya no está disponible en el servidor.'
      : (job.error?.message ?? 'El proceso terminó con un error inesperado.');

  const hint = cancelled
    ? 'Puedes iniciar una nueva preparación cuando quieras.'
    : expired
      ? 'Vuelve a preparar la APK para generar un archivo nuevo.'
      : job.error?.hint;

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${tone.border} ${tone.background} shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${tone.icon}`}
          >
            {cancelled || expired ? (
              <InfoIcon className="h-6 w-6" />
            ) : (
              <AlertTriangleIcon className="h-6 w-6" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone.badge}`}
            >
              {tone.label}
              {job.error?.code ? (
                <span className="font-mono normal-case tracking-normal opacity-80">
                  · {job.error.code}
                </span>
              ) : null}
            </span>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className={`mt-1 text-sm leading-relaxed ${tone.text}`}>{message}</p>
            {hint ? (
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{hint}</p>
            ) : null}
          </div>
        </div>

        {job.error?.detail ? (
          <details className="group mt-5 overflow-hidden rounded-xl border border-white/[0.07] bg-black/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-200">
              Detalle técnico
              <ChevronDownIcon className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <pre className="log-scroll max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-white/[0.06] px-4 py-3 font-mono text-[11px] leading-relaxed text-zinc-500">
              {job.error.detail}
            </pre>
          </details>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-lab-lime px-5 text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(184,243,107,0.65)] transition hover:bg-lab-lime-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-lab-lime/25"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Intentar de nuevo
          </button>
          <a
            href="#como-funciona"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            Ver cómo funciona
          </a>
        </div>

        {logs.length > 0 ? (
          <details className="group mt-3 overflow-hidden rounded-xl border border-white/[0.07] bg-black/25">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.02]">
              <span>Ver logs del proceso ({logs.length})</span>
              <ChevronDownIcon className="h-4 w-4 text-zinc-500 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-white/[0.06] p-3">
              <LogConsole logs={logs} title="Logs del proceso" heightClass="h-64" />
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
