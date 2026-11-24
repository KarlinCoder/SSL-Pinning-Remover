import { ExternalLinkIcon, TerminalIcon } from './Icons';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/[0.06] py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400">
            <TerminalIcon className="h-4 w-4" />
          </span>
          <div className="text-sm">
            <p className="font-medium text-zinc-300">APK HTTPS Lab</p>
            <p className="text-xs text-zinc-500">
              Laboratorio de preparación de APKs para inspección de tráfico.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
          <a
            href="https://github.com/niklashigi/apk-mitm"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition hover:text-zinc-200"
          >
            apk-mitm
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
          <a
            href="https://apktool.org"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition hover:text-zinc-200"
          >
            apktool
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
          <a
            href="https://github.com/patrickfav/uber-apk-signer"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition hover:text-zinc-200"
          >
            uber-apk-signer
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      </div>

      <p className="mx-auto mt-8 max-w-6xl px-4 text-[11px] leading-relaxed text-zinc-600 sm:px-6">
        Utiliza esta herramienta únicamente con aplicaciones y dispositivos que
        controles o para los que tengas autorización expresa. La modificación de
        APKs puede infringir términos de servicio o la legislación de tu país.
        Los archivos se eliminan automáticamente del servidor al expirar.
      </p>
    </footer>
  );
}
