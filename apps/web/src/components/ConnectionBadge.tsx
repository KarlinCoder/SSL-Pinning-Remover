import type { ConnectionState } from '../types';

const STYLES: Record<
  ConnectionState,
  { label: string; badge: string; dot: string; pulse: boolean }
> = {
  connecting: {
    label: 'Conectando',
    badge: 'border-amber-400/20 bg-amber-400/[0.06] text-amber-300',
    dot: 'bg-amber-400',
    pulse: true,
  },
  live: {
    label: 'En vivo',
    badge: 'border-lab-lime/25 bg-lab-lime/[0.07] text-lab-lime',
    dot: 'bg-lab-lime',
    pulse: true,
  },
  reconnecting: {
    label: 'Reconectando',
    badge: 'border-amber-400/20 bg-amber-400/[0.06] text-amber-300',
    dot: 'bg-amber-400',
    pulse: true,
  },
  closed: {
    label: 'Desconectado',
    badge: 'border-white/10 bg-white/[0.03] text-zinc-500',
    dot: 'bg-zinc-500',
    pulse: false,
  },
};

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  const style = STYLES[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${style.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot} ${style.pulse ? 'animate-lab-pulse' : ''}`}
      />
      {style.label}
    </span>
  );
}
