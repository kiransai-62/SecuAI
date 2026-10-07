import React from 'react';
import { Search, BrainCircuit, Wrench, ShieldCheck, RefreshCw, ChevronRight } from 'lucide-react';
import { LoopStep } from '../types';

interface LoopStepperProps {
  currentStep?: LoopStep;
  stats: {
    detectedCount: number;
    explainedCount: number;
    fixedCount: number;
    verifiedCount: number;
  };
}

export const LoopStepper: React.FC<LoopStepperProps> = ({ stats }) => {
  const steps = [
    {
      id: 'DETECT' as LoopStep,
      title: '1. DETECT',
      subtitle: 'Static SAST & Secrets',
      engine: 'isitsecure',
      icon: Search,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50/60 border-rose-200/80',
      glow: 'shadow-2xs',
      count: stats.detectedCount,
      badge: 'Scanner-driven',
    },
    {
      id: 'EXPLAIN' as LoopStep,
      title: '2. EXPLAIN',
      subtitle: 'Root Cause & Blast Radius',
      engine: 'Gemini 3.8',
      icon: BrainCircuit,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50/60 border-purple-200/80',
      glow: 'shadow-2xs',
      count: stats.explainedCount,
      badge: 'AI Server-side',
    },
    {
      id: 'FIX' as LoopStep,
      title: '3. FIX',
      subtitle: 'Propose Clean Unified Diff',
      engine: 'Gemini 3.8',
      icon: Wrench,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50/60 border-blue-200/80',
      glow: 'shadow-2xs',
      count: stats.fixedCount,
      badge: 'Git Diff',
    },
    {
      id: 'VERIFY' as LoopStep,
      title: '4. VERIFY',
      subtitle: 'Deterministic AST Check',
      engine: 'isitsecure',
      icon: ShieldCheck,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50/60 border-emerald-200/80',
      glow: 'shadow-2xs',
      count: stats.verifiedCount,
      badge: 'Scanner Only',
    },
    {
      id: 'RE_SCAN' as LoopStep,
      title: '5. RE-SCAN',
      subtitle: 'Verify Zero Regressions',
      engine: 'Worker Polling',
      icon: RefreshCw,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50/60 border-indigo-200/80',
      glow: 'shadow-2xs',
      count: stats.verifiedCount > 0 ? 1 : 0,
      badge: 'Closed Loop',
    },
  ];

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-slate-900 uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            Autonomous Feedback Loop
          </h2>
          <p className="text-xs text-slate-500">
            Strict Separation: <strong className="text-slate-700">isitsecure</strong> does 100% of detection & verification; <strong className="text-slate-700">Gemini</strong> only explains and generates patches.
          </p>
        </div>
        <div className="text-xs font-mono px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold self-start sm:self-auto">
          Status: {stats.verifiedCount === stats.detectedCount ? 'ALL VULNERABILITIES NEUTRALIZED' : 'ACTIVE MITIGATION'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative group">
              <div
                className={`p-3.5 rounded-xl border transition-all duration-300 h-full flex flex-col justify-between ${step.bgColor} ${step.glow} hover:scale-[1.02]`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                      {step.engine}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200/60 ${step.color}`}>
                      {step.badge}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mb-1">
                    <div className={`p-1.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs ${step.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 tracking-tight">{step.title}</span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-snug">{step.subtitle}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Processed:</span>
                  <span className={`font-mono font-bold ${step.color}`}>{step.count}</span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300 pointer-events-none">
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
