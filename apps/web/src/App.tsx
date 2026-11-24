import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorCard } from './components/ErrorCard';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import {
  AlertTriangleIcon,
  LoaderIcon,
  RefreshCwIcon,
  TerminalIcon,
} from './components/Icons';
import { JobPanel } from './components/JobPanel';
import { ResultCard } from './components/ResultCard';
import { UrlForm } from './components/UrlForm';
import { useJob } from './hooks/useJob';
import { ApiError, api } from './lib/api';
import type { AppConfig, JobSnapshot } from './types';

type BootState = 'loading' | 'ready' | 'error';

function BootScreen({
  error,
  onRetry,
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-lab-bg px-4">
      <div className="pointer-events-none absolute inset-0 bg-lab-glow" />
      <div className="pointer-events-none absolute inset-0 bg-lab-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_20%,transparent_75%)]" />

      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-lab-lime/30 bg-lab-lime/10 text-lab-lime shadow-[0_0_30px_-6px_rgba(184,243,107,0.6)]">
          <TerminalIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-white">
          APK HTTPS Lab
        </h1>

        {error ? (
          <>
            <div className="mt-4 flex w-full items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-left text-xs text-red-200">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="font-medium">No se pudo conectar con el servidor</p>
                <p className="mt-1 leading-relaxed text-red-200/70">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              <RefreshCwIcon className="h-4 w-4" />
              Reintentar
            </button>
          </>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <LoaderIcon className="h-4 w-4 text-lab-lime" />
            Conectando con el laboratorio…
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [bootState, setBootState] = useState<BootState>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootKey, setBootKey] = useState(0);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [initialJob, setInitialJob] = useState<JobSnapshot | null>(null);
  const jobSectionRef = useRef<HTMLDivElement>(null);

  const { job, logs, connection } = useJob(jobId, initialJob);
  const activeJob = jobId ? (job ?? initialJob) : null;

  useEffect(() => {
    let cancelled = false;

    setBootState('loading');
    setBootError(null);

    (async () => {
      try {
        const appConfig = await api.getConfig();

        if (cancelled) return;

        setConfig(appConfig);
        setBootState('ready');
      } catch (error) {
        if (cancelled) return;

        setBootError(
          error instanceof ApiError
            ? error.message
            : 'No se pudo conectar con el servidor.',
        );
        setBootState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootKey]);

  useEffect(() => {
    if (!jobId) return;

    const timer = window.setTimeout(() => {
      jobSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [jobId]);

  const handleCreate = useCallback(async (url: string) => {
    const snapshot = await api.createJob(url);
    setInitialJob(snapshot);
    setJobId(snapshot.id);
  }, []);

  const handleUpload = useCallback(async (file: File, onProgress?: (percent: number) => void) => {
    const snapshot = await api.uploadFile(file, onProgress);
    setInitialJob(snapshot);
    setJobId(snapshot.id);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!jobId) return;
    await api.cancelJob(jobId);
  }, [jobId]);

  const handleReset = useCallback(() => {
    setJobId(null);
    setInitialJob(null);
  }, []);

  if (bootState === 'loading') {
    return <BootScreen />;
  }

  if (bootState === 'error' || !config) {
    return (
      <BootScreen
        error={bootError ?? 'Respuesta inválida del servidor.'}
        onRetry={() => setBootKey((value) => value + 1)}
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-lab-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-lab-glow" />
      <div className="pointer-events-none absolute inset-0 bg-lab-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_30%,transparent_75%)]" />

      <div className="relative z-10">
        <Header showLogout={false} onLogout={() => {}} />

        <main>
          <Hero />

          <section className="mx-auto max-w-3xl px-4 sm:px-6">
            <div ref={jobSectionRef} className="scroll-mt-24">
              {!activeJob ? (
                <UrlForm onSubmit={handleCreate} onUpload={handleUpload} maxApkMb={config.maxApkMb} />
              ) : activeJob.status === 'completed' ? (
                <ResultCard job={activeJob} logs={logs} onReset={handleReset} />
              ) : activeJob.status === 'failed' ||
                activeJob.status === 'cancelled' ||
                activeJob.status === 'expired' ? (
                <ErrorCard job={activeJob} logs={logs} onReset={handleReset} />
              ) : (
                <JobPanel
                  job={activeJob}
                  logs={logs}
                  connection={connection}
                  onCancel={handleCancel}
                />
              )}
            </div>
          </section>

          <Features />
        </main>

        <Footer />
      </div>
    </div>
  );
}