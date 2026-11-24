import type { ReactNode } from 'react';
import {
  DownloadIcon,
  FileArchiveIcon,
  LinkIcon,
  LockIcon,
  PackageIcon,
  ServerIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TerminalIcon,
} from './Icons';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Descarga directa',
    description:
      'El backend descarga el archivo desde la URL que indiques, con protección anti-SSRF, límite de tamaño y timeout.',
    icon: <LinkIcon className="h-5 w-5" />,
  },
  {
    number: '02',
    title: 'Detección y parcheo',
    description:
      'Se detecta APK, XAPK o APKS y apk-mitm parchea el manifest, la network security config y el certificate pinning.',
    icon: <ShieldCheckIcon className="h-5 w-5" />,
  },
  {
    number: '03',
    title: 'Recompilación y firma',
    description:
      'apktool reconstruye el paquete y uber-apk-signer lo firma de nuevo para que pueda instalarse en el dispositivo.',
    icon: <PackageIcon className="h-5 w-5" />,
  },
  {
    number: '04',
    title: 'Descarga del resultado',
    description:
      'Recibes un enlace temporal con el archivo preparado, su hash SHA-256 y todos los logs del proceso.',
    icon: <DownloadIcon className="h-5 w-5" />,
  },
];

const SAFETY = [
  {
    icon: <LockIcon className="h-4 w-4" />,
    title: 'Anti-SSRF',
    text: 'Bloqueo de IPs privadas, puertos no permitidos y redirecciones controladas.',
  },
  {
    icon: <ServerIcon className="h-4 w-4" />,
    title: 'Límites del servidor',
    text: 'Cola de trabajos, tamaño máximo, timeout y espacio en disco comprobado.',
  },
  {
    icon: <FileArchiveIcon className="h-4 w-4" />,
    title: 'Archivos efímeros',
    text: 'Cada trabajo se borra automáticamente al expirar el enlace de descarga.',
  },
];

export function Features() {
  return (
    <section id="como-funciona" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-lab-lime">
            Pipeline
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Del enlace a la APK parcheada
          </h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-zinc-500">
          Todo ocurre en el contenedor: no necesitas Java, apktool ni ninguna
          herramienta en tu máquina.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <article
            key={step.number}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-lab-panel/60 p-5 transition hover:border-lab-lime/25 hover:bg-lab-panel"
          >
            <span className="pointer-events-none absolute -right-1 -top-3 font-mono text-5xl font-bold text-white/[0.035] transition group-hover:text-lab-lime/[0.08]">
              {step.number}
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-lab-lime/20 bg-lab-lime/[0.07] text-lab-lime">
              {step.icon}
            </span>
            <h3 className="mt-4 text-sm font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
              {step.description}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:grid-cols-3 sm:p-6">
        {SAFETY.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-black/40 text-zinc-400">
              {item.icon}
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-200">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-lab-lime/15 bg-lab-lime/[0.04] p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lab-lime/25 bg-lab-lime/10 text-lab-lime">
            <SmartphoneIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-white">
              ¿Paquete dividido? Usa SAI o adb install-multiple
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">
              Los XAPK y APKS contienen varios APKs. Instálalos con Split APKs
              Installer (SAI) o con{' '}
              <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-lab-lime-soft">
                adb install-multiple
              </code>
              . Después instala el certificado de mitmproxy en el dispositivo.
            </p>
          </div>
        </div>
        <a
          href="https://github.com/niklashigi/apk-mitm"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-lab-lime/25 bg-lab-lime/10 px-3.5 py-2 text-xs font-medium text-lab-lime transition hover:bg-lab-lime/15"
        >
          <TerminalIcon className="h-4 w-4" />
          Cómo funciona apk-mitm
        </a>
      </div>
    </section>
  );
}
