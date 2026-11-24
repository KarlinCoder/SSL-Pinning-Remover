import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/format';
import type { JobLog, JobSnapshot, PackageKind } from '../types';
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  FileArchiveIcon,
  HashIcon,
  RefreshCwIcon,
  SmartphoneIcon,
} from './Icons';
import { LogConsole } from './LogConsole';

const KIND_LABEL: Record<PackageKind, string> = {
  apk: 'APK única',
  xapk: 'XAPK · split',
  apks: 'APKS · split',
};

interface ResultCardProps {
  job: JobSnapshot;
  logs: JobLog[];
  onReset: () => void;
}

function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ResultCard({ job, logs, onReset }: ResultCardProps) {
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const artifact = job.artifact;

  useEffect(() => {
    if (!artifact) return;

    const expiresAt = Date.parse(artifact.expiresAt);
    if (!Number.isFinite(expiresAt)) return;

    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      setExpired(true);
      return;
    }

    setExpired(false);
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [artifact]);

  if (!artifact) return null;

  const isSplit = artifact.kind === 'xapk' || artifact.kind === 'apks';

  async function handleCopy() {
    if (!artifact) return;

    try {
      await navigator.clipboard.writeText(artifact.sha256);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-lab-lime/25 bg-linear-to-b from-lab-lime/[0.08] via-lab-panel/80 to-lab-panel/80 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-lab-lime/30 bg-lab-lime/15 text-lab-lime shadow-[0_0_30px_-8px_rgba(184,243,107,0.7)]">
            <CheckIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-lab-lime">
              Listo
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              APK preparada para inspección HTTPS
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              El certificate pinning y la configuración de red se han parcheado.
              Descarga el archivo firmado e instálalo en tu dispositivo.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/30 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400">
              <FileArchiveIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Archivo generado
              </p>
              <p className="mt-1 break-all font-mono text-sm text-white">
                {artifact.filename}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-lab-lime/20 bg-lab-lime/[0.06] px-2 py-1 font-medium text-lab-lime">
              {KIND_LABEL[artifact.kind]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">
              <FileArchiveIcon className="h-3 w-3" />
              {formatBytes(artifact.size)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">
              <ClockIcon className="h-3 w-3" />
              Expira el {formatExpiry(artifact.expiresAt)}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              <HashIcon className="h-3 w-3" />
              SHA-256
            </p>
            <p
              className="mt-0.5 truncate font-mono text-[11px] text-zinc-400"
              title={artifact.sha256}
            >
              {artifact.sha256}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-zinc-400 transition hover:border-white/20 hover:text-white"
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-lab-lime" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>

        {expired ? (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-200">
            <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium">El enlace de descarga expiró</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-200/70">
                El archivo se eliminó del servidor. Prepara la APK de nuevo para
                generar un enlace nuevo.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a
              href={artifact.downloadUrl}
              download={artifact.filename}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-lab-lime px-5 text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(184,243,107,0.65)] transition hover:bg-lab-lime-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-lab-lime/25"
            >
              <DownloadIcon className="h-4 w-4" />
              Descargar APK preparada
            </a>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              <RefreshCwIcon className="h-4 w-4" />
              Preparar otra
            </button>
          </div>
        )}

        {expired ? (
          <button
            type="button"
            onClick={onReset}
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Preparar otra
          </button>
        ) : null}

        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-500">
          <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          El enlace de descarga y el archivo se eliminan del servidor
          automáticamente al expirar.
        </p>

        <details className="group mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-black/25">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.02]">
            <span className="inline-flex items-center gap-2">
              <SmartphoneIcon className="h-4 w-4 text-zinc-500" />
              Cómo instalar y usar la APK
            </span>
            <ChevronDownIcon className="h-4 w-4 text-zinc-500 transition group-open:rotate-180" />
          </summary>

          <div className="space-y-3 border-t border-white/[0.06] px-4 py-4 text-xs leading-relaxed text-zinc-400">
            <div>
              <p className="font-medium text-zinc-200">1. Instala el certificado de mitmproxy</p>
              <p className="mt-1">
                Exporta la CA de mitmproxy e instálala como certificado de usuario
                en el dispositivo. En Android 7+ las apps no confían en CAs de
                usuario salvo que estén parcheadas, que es exactamente lo que hace
                esta herramienta.
              </p>
            </div>

            <div>
              <p className="font-medium text-zinc-200">2. Instala el paquete</p>
              {isSplit ? (
                <p className="mt-1">
                  Es un paquete dividido ({artifact.kind.toUpperCase()}). Instálalo
                  con Split APKs Installer (SAI) o con{' '}
                  <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-lab-lime-soft">
                    adb install-multiple *.apk
                  </code>
                  .
                </p>
              ) : (
                <p className="mt-1">
                  Copia el APK al dispositivo e instálalo, o usa{' '}
                  <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-lab-lime-soft">
                    adb install &quot;{artifact.filename}&quot;
                  </code>
                  .
                </p>
              )}
            </div>

            <div>
              <p className="font-medium text-zinc-200">3. Inspecciona el tráfico</p>
              <p className="mt-1">
                Abre la app con mitmproxy en marcha. Si la app usa pinning nativo
                (NDK), comprobaciones de integridad o attesters, puede necesitar
                parches adicionales fuera del alcance de apk-mitm.
              </p>
            </div>
          </div>
        </details>

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
