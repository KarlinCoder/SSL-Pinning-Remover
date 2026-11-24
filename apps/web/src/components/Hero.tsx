import {
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
} from './Icons';

const BADGES = [
  'Certificate pinning neutralizado',
  'Network security config',
  'Firma automática',
  'Logs en vivo',
];

export function Hero() {
  return (
    <section id="top" className="relative">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-lab-lime/20 bg-lab-lime/[0.06] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-lab-lime">
            <SparklesIcon className="h-3.5 w-3.5" />
            apk-mitm · apktool · uber-apk-signer
          </div>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Prepara cualquier APK para{' '}
            <span className="bg-linear-to-r from-lab-lime via-lab-lime-soft to-emerald-300 bg-clip-text text-transparent">
              inspección HTTPS
            </span>
            .
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
            Pega un enlace directo a un APK, XAPK o APKS. El servidor lo descarga,
            neutraliza el certificate pinning, parchea la configuración de red y lo
            firma de nuevo. Tú solo descargas el resultado.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {BADGES.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400"
              >
                <CheckIcon className="h-3.5 w-3.5 text-lab-lime" />
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-600">
            <ShieldCheckIcon className="h-4 w-4 text-zinc-500" />
            Procesamiento aislado en el servidor
            <ZapIcon className="h-4 w-4 text-zinc-500" />
            Sin instalar nada en tu equipo
          </div>
        </div>
      </div>
    </section>
  );
}
