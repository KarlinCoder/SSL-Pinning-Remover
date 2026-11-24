import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../lib/format';
import type { ConnectionState, JobLog, LogLevel } from '../types';
import { ConnectionBadge } from './ConnectionBadge';
import { CheckIcon, CopyIcon, TerminalIcon } from './Icons';

interface LogConsoleProps {
  logs: JobLog[];
  connection?: ConnectionState;
  title?: string;
  heightClass?: string;
}

const LEVEL_STYLE: Record<
  LogLevel,
  { marker: string; markerClass: string; textClass: string }
> = {
  info: { marker: '›', markerClass: 'text-zinc-600', textClass: 'text-zinc-300' },
  success: { marker: '✓', markerClass: 'text-lab-lime', textClass: 'text-zinc-100' },
  warn: {
    marker: '!',
    markerClass: 'text-amber-400',
    textClass: 'text-amber-200/90',
  },
  error: { marker: '✕', markerClass: 'text-red-400', textClass: 'text-red-200' },
  debug: { marker: '·', markerClass: 'text-sky-400', textClass: 'text-zinc-400' },
};

const MAX_VISIBLE_LOGS = 800;

export function LogConsole({
  logs,
  connection,
  title = 'Log en vivo',
  heightClass = 'h-80',
}: LogConsoleProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const visible = logs.length > MAX_VISIBLE_LOGS ? logs.slice(-MAX_VISIBLE_LOGS) : logs;

  useEffect(() => {
    if (!autoScroll) return;
    const element = bodyRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [logs.length, autoScroll]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  async function handleCopy() {
    const text = logs
      .map((entry) => `[${formatTime(entry.ts)}] ${entry.level.toUpperCase()} ${entry.message}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text || 'Sin logs');
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
          <TerminalIcon className="h-4 w-4 text-zinc-500" />
          {title}
          {connection ? <ConnectionBadge state={connection} /> : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAutoScroll((value) => !value)}
            aria-pressed={autoScroll}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
          >
            <span
              className={`relative h-3 w-5 rounded-full transition ${
                autoScroll ? 'bg-lab-lime/70' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-0.5 h-2 w-2 rounded-full bg-black transition-all ${
                  autoScroll ? 'left-2.5' : 'left-0.5'
                }`}
              />
            </span>
            Auto-scroll
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-lab-lime" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div
        ref={bodyRef}
        className={`log-scroll ${heightClass} overflow-y-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed`}
        role="log"
        aria-live="polite"
      >
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-600">
            <span className="h-1.5 w-1.5 animate-lab-pulse rounded-full bg-zinc-500" />
            Esperando eventos del servidor…
          </div>
        ) : (
          <div className="space-y-1">
            {logs.length > MAX_VISIBLE_LOGS ? (
              <p className="pb-1 text-[10px] uppercase tracking-wider text-zinc-700">
                Mostrando los últimos {MAX_VISIBLE_LOGS} eventos
              </p>
            ) : null}

            {visible.map((entry) => {
              const style = LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.info;

              return (
                <div key={entry.seq} className="flex gap-2.5">
                  <span className="shrink-0 select-none text-zinc-700">
                    {formatTime(entry.ts)}
                  </span>
                  <span
                    className={`w-3 shrink-0 select-none font-bold ${style.markerClass}`}
                  >
                    {style.marker}
                  </span>
                  <span
                    className={`whitespace-pre-wrap break-words ${style.textClass}`}
                  >
                    {entry.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
