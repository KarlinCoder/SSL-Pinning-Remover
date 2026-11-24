import { useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  LinkIcon,
  LoaderIcon,
  ZapIcon,
} from './Icons';

interface UrlFormProps {
  onSubmit: (url: string) => Promise<void>;
  maxApkMb: number;
}

interface FormError {
  message: string;
  hint?: string;
}

function validateUrl(raw: string): string | null {
  const value = raw.trim();

  if (!value) return 'Pega el enlace directo al archivo.';
  if (!/^https?:\/\//i.test(value)) {
    return 'El enlace debe empezar por http:// o https://.';
  }

  try {
    const parsed = new URL(value);
    if (!parsed.hostname) {
      return 'El enlace no tiene un dominio válido.';
    }
  } catch {
    return 'El enlace no es una URL válida.';
  }

  return null;
}

export function UrlForm({ onSubmit, maxApkMb }: UrlFormProps) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const value = url.trim();
    const validation = validateUrl(value);

    if (validation) {
      setError({ message: validation });
      inputRef.current?.focus();
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onSubmit(value);
      setUrl('');
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError({ message: submitError.message, hint: submitError.hint });
      } else {
        setError({
          message:
            submitError instanceof Error
              ? submitError.message
              : 'No se pudo crear el trabajo.',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste() {
    if (busy) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        setError(null);
      }
      inputRef.current?.focus();
    } catch {
      setError({
        message:
          'No se pudo leer el portapapeles. Pega el enlace manualmente en el campo.',
      });
      inputRef.current?.focus();
    }
  }

  return (
    <div id="preparar" className="scroll-mt-28">
      <form
        onSubmit={handleSubmit}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-lab-panel/80 p-2 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)] backdrop-blur"
        noValidate
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-lab-lime/50 to-transparent" />

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              ref={inputRef}
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (error) setError(null);
              }}
              placeholder="https://ejemplo.com/app-release.apk"
              aria-label="Enlace directo al APK, XAPK o APKS"
              spellCheck={false}
              autoComplete="off"
              maxLength={4096}
              disabled={busy}
              className="h-14 w-full rounded-xl border border-transparent bg-black/50 pl-12 pr-20 text-[15px] text-white placeholder:text-zinc-600 transition focus:border-lab-lime/40 focus:outline-none focus:ring-4 focus:ring-lab-lime/10 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handlePaste}
              disabled={busy}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              Pegar
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="group inline-flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-lab-lime px-6 text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(184,243,107,0.65)] transition hover:bg-lab-lime-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-lab-lime/25 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? (
              <LoaderIcon className="h-4 w-4" />
            ) : (
              <ZapIcon className="h-4 w-4" />
            )}
            <span>{busy ? 'Creando trabajo…' : 'Preparar para inspección HTTPS'}</span>
            {!busy ? (
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            ) : null}
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200"
          >
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="font-medium">{error.message}</p>
              {error.hint ? (
                <p className="mt-1 text-xs leading-relaxed text-red-200/70">
                  {error.hint}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>

      <div className="mt-3 flex flex-col gap-1.5 px-1 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Enlaces directos <span className="text-zinc-400">.apk</span>,{' '}
          <span className="text-zinc-400">.xapk</span> y{' '}
          <span className="text-zinc-400">.apks</span> · máximo {maxApkMb} MB
        </p>
        <p>No se admiten páginas de descarga ni enlaces que requieran login.</p>
      </div>
    </div>
  );
}
