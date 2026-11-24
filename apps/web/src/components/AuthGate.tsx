import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../lib/api';
import type { AuthState } from '../types';
import {
  AlertTriangleIcon,
  KeyRoundIcon,
  LoaderIcon,
  LockIcon,
  TerminalIcon,
} from './Icons';

interface AuthGateProps {
  onSuccess: (state: AuthState) => void;
}

export function AuthGate({ onSuccess }: AuthGateProps) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (!password) {
      setError('Introduce la contraseña.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const state = await api.login(password);
      onSuccess(state);
    } catch (loginError) {
      if (loginError instanceof ApiError) {
        setError(loginError.message);
      } else {
        setError('No se pudo iniciar sesión. Comprueba la conexión.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-lab-glow" />
      <div className="pointer-events-none absolute inset-0 bg-lab-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,#000_20%,transparent_75%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-lab-lime/30 bg-lab-lime/10 text-lab-lime shadow-[0_0_30px_-6px_rgba(184,243,107,0.6)]">
            <TerminalIcon className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            APK HTTPS Lab
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Laboratorio privado de preparación de APKs
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-lab-panel/80 p-6 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)] backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400">
              <LockIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Acceso restringido
              </h2>
              <p className="text-xs text-zinc-500">
                Introduce la contraseña configurada en APP_PASSWORD.
              </p>
            </div>
          </div>

          <form className="mt-5" onSubmit={handleSubmit} noValidate>
            <label
              htmlFor="lab-password"
              className="text-[10px] font-medium uppercase tracking-wider text-zinc-500"
            >
              Contraseña
            </label>
            <div className="relative mt-1.5">
              <KeyRoundIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="lab-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
                autoFocus
                autoComplete="current-password"
                disabled={busy}
                placeholder="••••••••••••"
                className="h-11 w-full rounded-xl border border-transparent bg-black/50 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 transition focus:border-lab-lime/40 focus:outline-none focus:ring-4 focus:ring-lab-lime/10 disabled:opacity-60"
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-xs text-red-200"
              >
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-lab-lime text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(184,243,107,0.65)] transition hover:bg-lab-lime-soft focus:outline-none focus-visible:ring-4 focus-visible:ring-lab-lime/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? (
                <LoaderIcon className="h-4 w-4" />
              ) : (
                <LockIcon className="h-4 w-4" />
              )}
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-600">
          Si no conoces la contraseña, pídesela al administrador del servidor.
        </p>
      </div>
    </div>
  );
}
