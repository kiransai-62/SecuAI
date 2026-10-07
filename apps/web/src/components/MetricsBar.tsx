import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Clock, FolderGit2 } from 'lucide-react';
import { Scan } from '../types';

interface MetricsBarProps {
  scan: Scan;
  totalFindings: number;
  verifiedCount: number;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ scan, totalFindings, verifiedCount }) => {
  const score = scan.security_score ?? 100;
  const isHealthy = score >= 80;
  const isModerate = score >= 50 && score < 80;

  const scoreColor = isHealthy
    ? 'text-emerald-400'
    : isModerate
    ? 'text-amber-400'
    : 'text-rose-400';

  const scoreBorder = isHealthy
    ? 'border-emerald-500/30'
    : isModerate
    ? 'border-amber-500/30'
    : 'border-rose-500/30';

  const scoreBg = isHealthy
    ? 'from-emerald-500/10 to-emerald-500/5'
    : isModerate
    ? 'from-amber-500/10 to-amber-500/5'
    : 'from-rose-500/10 to-rose-500/5';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Security Health Score */}
      <div className={`p-4 rounded-2xl bg-white border ${scoreBorder} shadow-xs flex items-center justify-between`}>
        <div>
          <span className="text-xs uppercase font-mono font-semibold tracking-wider text-slate-400">Security Score</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className={`text-4xl font-extrabold font-mono tracking-tight ${scoreColor}`}>{score}</span>
            <span className="text-xs text-slate-400">/ 100</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isHealthy ? 'Clean application state' : `${totalFindings - verifiedCount} open security risks`}
          </p>
        </div>

        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-100"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={scoreColor}
              strokeDasharray={`${score}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className={`absolute text-xs font-mono font-bold ${scoreColor}`}>
            {score}%
          </span>
        </div>
      </div>

      {/* Critical & High Findings Count */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono font-semibold tracking-wider text-slate-400">Severity Breakdown</span>
          <ShieldAlert className="w-4 h-4 text-rose-500" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200/60">
            <span className="text-[10px] font-mono uppercase font-semibold text-rose-600">Critical</span>
            <div className="text-lg font-bold font-mono text-rose-700">{scan.critical_count}</div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/60">
            <span className="text-[10px] font-mono uppercase font-semibold text-amber-600">High</span>
            <div className="text-lg font-bold font-mono text-amber-700">{scan.high_count}</div>
          </div>
        </div>
      </div>

      {/* Verification Status */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono font-semibold tracking-wider text-slate-400">Neutralized</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <div className="flex items-baseline space-x-1">
            <span className="text-3xl font-extrabold font-mono text-emerald-600">{verifiedCount}</span>
            <span className="text-xs text-slate-500 font-mono">/ {totalFindings} verified</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${totalFindings ? (verifiedCount / totalFindings) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Target & Scanner Specs */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-mono font-semibold tracking-wider text-slate-400">Target Workspace</span>
          <FolderGit2 className="w-4 h-4 text-blue-500" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-mono font-medium text-slate-800 truncate" title={scan.target_path}>
            {scan.target_path}
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-500">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{scan.scan_duration_seconds}s</span>
            </span>
            <span>•</span>
            <span className="font-mono text-blue-600 uppercase text-[10px] font-semibold">{scan.scan_mode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
