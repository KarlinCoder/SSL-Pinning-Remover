import { useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { ApiError, api } from '../lib/api';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  LinkIcon,
  LoaderIcon,
  UploadIcon,
  ZapIcon,
  XIcon,
} from './Icons';

interface UrlFormProps {
  onSubmit: (url: string) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
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

function validateFile(file: File, maxMb: number): string | null {
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['apk', 'xapk', 'apks', 'zip'].includes(ext || '')) {
    return 'Formato no permitido. Solo .apk, .xapk, .apks o .zip';
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `El archivo supera el límite de ${maxMb} MB.`;
  }
  return null;
}

export function UrlForm({ onSubmit, onUpload, maxApkMb }: UrlFormProps) {
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('url');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function clearError() {
    setError(null);
  }

  async function handleSubmitUrl(event: FormEvent<HTMLFormElement>) {
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (file) {
      const validation = validateFile(file, maxApkMb);
      if (validation) {
        setError({ message: validation });
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  }

  async function handleSubmitFile() {
    if (busy || !selectedFile) return;

    setBusy(true);
    setError(null);

    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
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

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.currentTarget.classList.add('border-lab-lime/50', 'bg-lab-lime/[0.03]');
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    event.currentTarget.classList.remove('border-lab-lime/50', 'bg-lab-lime/[0.03]');
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    event.currentTarget.classList.remove('border-lab-lime/50', 'bg-lab-lime/[0.03]');
    const file = event.dataTransfer.files[0];
    if (file) {
      const validation = validateFile(file, maxApkMb);
      if (validation) {
        setError({ message: validation });
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  }

  return (
    <div id="preparar" className="scroll-mt-28">
      <div className="mb-4 flex gap-1 border-b border-white/10">
        <button
          type="button"
          onClick={() => {
            setActiveTab('url');
            setError(null);
            setSelectedFile(null);
            if (fileRef.current) fileRef.current.value = '';
          }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium uppercase tracking-wider transition ${
            activeTab === 'url'
              ? 'text-lab-lime border-b-2 border-lab-lime'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Enlace URL
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('file');
            setError(null);
            setUrl('');
          }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium uppercase tracking-wider transition ${
            activeTab === 'file'
              ? 'text-lab-lime border-b-2 border-lab-lime'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Subir archivo
        </button>
      </div>

      {activeTab === 'url' ? (
        <form onSubmit={handleSubmitUrl} className="space-y-3" noValidate>
          <div className="relative flex flex-col gap-2 sm:flex-row">
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
              className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200"
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
      ) : (
        <div className="space-y-3">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-xl border-2 border-dashed border-white/10 bg-black/30 p-8 transition hover:border-lab-lime/30 ${
              selectedFile ? 'border-lab-lime/50 bg-lab-lime/[0.05]' : ''
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              id="file-upload"
              accept=".apk,.xapk,.apks,.zip"
              onChange={handleFileChange}
              disabled={busy}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center gap-3 cursor-pointer"
            >
              <UploadIcon className="h-12 w-12 text-zinc-500" />
              <div className="text-center">
                <p className="font-medium text-white">
                  {selectedFile ? selectedFile.name : 'Arrastra y suelta tu APK, XAPK o APKS aquí'}
                </p>
                <p className="text-xs text-zinc-500">o haz clic para seleccionar · máx {maxApkMb} MB</p>
              </div>
            </label>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400">
                  <UploadIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{selectedFile.name}</p>
                  <p className="text-xs text-zinc-500">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileRef.current) fileRef.current.value = '';
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-white/20 hover:text-white"
              >
                <XIcon className="h-3.5 w-3.5" />
                Quitar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmitFile}
            disabled={busy || !selectedFile}
            className="group inline-flex w-full h-14 items-center justify-center gap-2.5 rounded-xl bg-lab-lime px-6 text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(184,243,107,0.65)] transition hover:bg-lab-lime-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-lab-lime/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <LoaderIcon className="h-4 w-4" />
            ) : (
              <ZapIcon className="h-4 w-4" />
            )}
            <span>{busy ? 'Subiendo y creando trabajo…' : 'Preparar para inspección HTTPS'}</span>
            {!busy ? (
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            ) : null}
          </button>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200"
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
        </div>
      )}

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