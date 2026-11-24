import {
  ExternalLinkIcon,
  LogOutIcon,
  TerminalIcon,
} from './Icons';

interface HeaderProps {
  showLogout: boolean;
  onLogout: () => void;
}

export function Header({ showLogout, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-lab-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="group flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-lab-lime/30 bg-lab-lime/10 text-lab-lime shadow-[0_0_24px_-6px_rgba(184,243,107,0.55)] transition group-hover:border-lab-lime/60">
            <TerminalIcon className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-white">
              APK HTTPS Lab
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              apk-mitm pipeline
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <a href="#preparar" className="transition hover:text-white">
            Preparar
          </a>
          <a href="#como-funciona" className="transition hover:text-white">
            Cómo funciona
          </a>
          <a
            href="https://github.com/niklashigi/apk-mitm"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition hover:text-white"
          >
            apk-mitm
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-lab-pulse rounded-full bg-lab-lime" />
            Servicio operativo
          </span>

          {showLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              <LogOutIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
