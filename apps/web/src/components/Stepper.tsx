import type { JobPhase, JobStatus } from '../types';
import { CheckIcon, XIcon } from './Icons';

interface Step {
  label: string;
  phases: JobPhase[];
}

const STEPS: Step[] = [
  { label: 'Descarga', phases: ['download'] },
  { label: 'Inspección', phases: ['inspect'] },
  { label: 'Decodificar', phases: ['decode'] },
  { label: 'Parches', phases: ['manifest', 'network-config', 'pinning'] },
  { label: 'Recompilar', phases: ['build'] },
  { label: 'Firma', phases: ['sign'] },
  { label: 'Empaquetar', phases: ['package', 'done'] },
];

interface StepperProps {
  phase: JobPhase;
  status: JobStatus;
}

export function Stepper({ phase, status }: StepperProps) {
  const completed = status === 'completed';
  const failed = status === 'failed' || status === 'cancelled';

  const currentIndex =
    status === 'queued' ? -1 : STEPS.findIndex((step) => step.phases.includes(phase));

  return (
    <ol className="grid grid-cols-4 gap-x-1 gap-y-4 sm:grid-cols-7">
      {STEPS.map((step, index) => {
        const isDone = completed || (currentIndex >= 0 && index < currentIndex);
        const isActive = !completed && index === currentIndex;
        const isError = isActive && failed;
        const reached = completed || index <= currentIndex;
        const reachedNext = completed || index < currentIndex;

        return (
          <li key={step.label} className="flex flex-col items-center gap-2">
            <div className="flex w-full items-center">
              <span
                className={`h-px flex-1 ${
                  index === 0
                    ? 'bg-transparent'
                    : reached
                      ? 'bg-lab-lime/40'
                      : 'bg-white/10'
                }`}
              />
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition ${
                  isError
                    ? 'border-red-400/40 bg-red-400/10 text-red-300'
                    : isDone
                      ? 'border-lab-lime/40 bg-lab-lime/15 text-lab-lime'
                      : isActive
                        ? 'border-lab-lime bg-lab-lime text-black shadow-[0_0_22px_-4px_rgba(184,243,107,0.8)]'
                        : 'border-white/10 bg-white/[0.02] text-zinc-600'
                }`}
              >
                {isError ? (
                  <XIcon className="h-3.5 w-3.5" />
                ) : isDone ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <span className="h-1.5 w-1.5 animate-lab-pulse rounded-full bg-black" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </span>
              <span
                className={`h-px flex-1 ${
                  index === STEPS.length - 1
                    ? 'bg-transparent'
                    : reachedNext
                      ? 'bg-lab-lime/40'
                      : 'bg-white/10'
                }`}
              />
            </div>
            <span
              className={`text-center text-[10px] font-medium uppercase tracking-wider sm:text-[11px] ${
                isError
                  ? 'text-red-300'
                  : isActive
                    ? 'text-lab-lime'
                    : isDone
                      ? 'text-zinc-300'
                      : 'text-zinc-600'
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
