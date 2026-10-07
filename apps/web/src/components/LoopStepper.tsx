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
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10 border-rose-500/30',
      glow: 'shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]',
      count: stats.detectedCount,
      badge: 'Scanner-driven',
    },
    {
      id: 'EXPLAIN' as LoopStep,
      title: '2. EXPLAIN',
      subtitle: 'Root Cause & Blast Radius',
      engine: 'Gemini 3.8',
      icon: BrainCircuit,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      glow: 'shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)]',
      count: stats.explainedCount,
      badge: 'AI Server-side',
    },
    {
      id: 'FIX' as LoopStep,
      title: '3. FIX',
      subtitle: 'Propose Clean Unified Diff',
      engine: 'Gemini 3.8',
      icon: Wrench,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
      glow: 'shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]',
      count: stats.fixedCount,
      badge: 'Git Diff',
    },
    {
      id: 'VERIFY' as LoopStep,
      title: '4. VERIFY',
      subtitle: 'Deterministic AST Check',
      engine: 'isitsecure',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      glow: 'shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]',
      count: stats.verifiedCount,
      badge: 'Scanner Only',
    },
    {
      id: 'RE_SCAN' as LoopStep,
      title: '5. RE-SCAN',
      subtitle: 'Verify Zero Regressions',
      engine: 'Worker Polling',
      icon: RefreshCw,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 border-blue-500/30',
      glow: 'shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]',
      count: stats.verifiedCount > 0 ? 1 : 0,
      badge: 'Closed Loop',
    },
  ];

  return (
    <div className="w-full bg-[#0a0e1a]/60 border border-white/5 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Autonomous Feedback Loop
          </h2>
          <p className="text-xs text-slate-400">
            Strict Separation: <strong className="text-slate-300">isitsecure</strong> does 100% of detection & verification; <strong className="text-slate-300">Gemini</strong> only explains and generates patches.
          </p>
        </div>
        <div className="text-xs font-mono px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 self-start sm:self-auto">
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
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${step.bgColor} ${step.color}`}>
                      {step.badge}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mb-1">
                    <div className={`p-1.5 rounded-lg bg-black/40 ${step.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white tracking-tight">{step.title}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">{step.subtitle}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">Processed:</span>
                  <span className={`font-mono font-bold ${step.color}`}>{step.count}</span>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600 pointer-events-none">
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
