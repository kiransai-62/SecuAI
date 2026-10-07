import React from 'react';
import { 
  FolderArchive, 
  Search, 
  Terminal, 
  Binary, 
  Gauge, 
  CheckCircle2, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { ScanProgressStep } from '../types';

interface ScanProgressStepperProps {
  currentStep?: ScanProgressStep | string | null;
  status: string;
  errorMessage?: string | null;
}

const STEPS: Array<{
  id: ScanProgressStep;
  title: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'Preparing',
    title: 'Preparing',
    description: 'Extracting safe workspace archive & sandbox setup',
    icon: FolderArchive,
  },
  {
    id: 'Detecting project',
    title: 'Detecting project',
    description: 'Analyzing dependencies, framework & route layout',
    icon: Search,
  },
  {
    id: 'Scanning',
    title: 'Scanning',
    description: 'Executing isitsecure static AST & taint subprocess',
    icon: Terminal,
  },
  {
    id: 'Normalizing',
    title: 'Normalizing',
    description: 'Generating stable fingerprints & checking regressions',
    icon: Binary,
  },
  {
    id: 'Scoring',
    title: 'Scoring',
    description: 'Calculating P7 penalties and security grade',
    icon: Gauge,
  },
  {
    id: 'Done',
    title: 'Done',
    description: 'Findings cataloged & report ready',
    icon: CheckCircle2,
  },
];

export const ScanProgressStepper: React.FC<ScanProgressStepperProps> = ({
  currentStep,
  status,
  errorMessage,
}) => {
  const normCurrent = currentStep || (status === 'QUEUED' || status === 'queued' ? 'Preparing' : 'Scanning');
  const isFailed = status === 'FAILED' || status === 'failed';

  // Find index of current step
  const currentIndex = STEPS.findIndex(
    (s) => s.id.toLowerCase() === String(normCurrent).toLowerCase()
  );
  const activeStepIdx = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div
      className="w-full bg-[#0d131f]/80 backdrop-blur-md border border-white/5 rounded-2xl p-6 md:p-8 shadow-xl"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              {!isFailed ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              )}
            </span>
            <h2 className="text-lg font-bold text-white font-mono tracking-tight">
              {isFailed
                ? 'Scan Execution Failed'
                : status === 'QUEUED' || status === 'queued'
                ? 'Scan Enqueued'
                : 'Security Analysis in Progress'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isFailed
              ? 'Scan was interrupted or encountered an unexpected issue.'
              : `Current phase: ${STEPS[activeStepIdx]?.title} — polling backend every 2s.`}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span>Step {Math.min(activeStepIdx + 1, STEPS.length)} of {STEPS.length}</span>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 relative">
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = !isFailed && idx < activeStepIdx;
          const isCurrent = !isFailed && idx === activeStepIdx;
          const isUpcoming = idx > activeStepIdx && !isFailed;

          return (
            <div
              key={step.id}
              className={`relative flex flex-col items-center md:items-start p-4 rounded-xl transition-all duration-300 border ${
                isCurrent
                  ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]'
                  : isCompleted
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-white/[0.02] border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-2 w-full">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border font-mono text-xs ${
                    isCompleted
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : isCurrent
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 animate-pulse'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </div>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                  0{idx + 1}
                </span>
              </div>

              <div className="w-full">
                <p
                  className={`text-xs font-semibold tracking-tight ${
                    isCurrent
                      ? 'text-cyan-300 font-bold'
                      : isCompleted
                      ? 'text-emerald-300'
                      : 'text-slate-400'
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-[10px] text-slate-400 leading-tight mt-1 line-clamp-2">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Failure Message Callout */}
      {isFailed && errorMessage && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Error Notice: </span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
