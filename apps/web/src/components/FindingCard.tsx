import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  AlertTriangle, 
  BrainCircuit, 
  Wrench, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  FileCode2, 
  Fingerprint, 
  ShieldCheck,
  Terminal,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Finding } from '../types';
import { DiffViewer } from './DiffViewer';

interface FindingCardProps {
  finding: Finding;
  onExplain: (fingerprint: string) => Promise<void>;
  onProposeDiff: (fingerprint: string) => Promise<void>;
  onVerify: (fingerprint: string, diff: string) => Promise<void>;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  onExplain,
  onProposeDiff,
  onVerify,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const isVerified = finding.status === 'verified';
  const isCritical = finding.severity === 'CRITICAL';

  const handleExplain = async () => {
    setLoadingAction('explain');
    await onExplain(finding.fingerprint);
    setLoadingAction(null);
    setIsExpanded(true);
  };

  const handleProposeDiff = async () => {
    setLoadingAction('fix');
    await onProposeDiff(finding.fingerprint);
    setLoadingAction(null);
    setIsExpanded(true);
  };

  const handleVerify = async () => {
    if (!finding.proposed_diff) return;
    setLoadingAction('verify');
    await onVerify(finding.fingerprint, finding.proposed_diff);
    setLoadingAction(null);
    
    // Trigger celebratory confetti on verification
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#10b981', '#06b6d4', '#3b82f6'],
    });
  };

  return (
    <div
      className={`rounded-2xl transition-all duration-300 border ${
        isVerified
          ? 'bg-emerald-950/10 border-emerald-500/30 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]'
          : isCritical
          ? 'bg-[#0b0e18] border-rose-500/25 hover:border-rose-500/40 hover:shadow-[0_0_25px_-10px_rgba(244,63,94,0.15)]'
          : 'bg-[#0b0e18] border-white/5 hover:border-cyan-500/30 hover:shadow-[0_0_25px_-10px_rgba(6,182,212,0.15)]'
      }`}
    >
      {/* Top Banner if verified */}
      {isVerified && (
        <div className="px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400 font-medium">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Remediation Verified by Scanner: Neutralized</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-500 uppercase">
            {finding.verification_result?.scanner_name || 'isitsecure'}
          </span>
        </div>
      )}

      {/* Main Card Header */}
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity: Text + Dot */}
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  finding.severity === 'CRITICAL'
                    ? 'bg-red-500'
                    : finding.severity === 'HIGH'
                    ? 'bg-orange-500'
                    : finding.severity === 'MEDIUM'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                aria-hidden="true"
              />
              <span>{finding.severity}</span>
            </span>

            {/* Source Badge */}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {finding.source}
            </span>

            {/* Category Badge */}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/5">
              {finding.category}
            </span>

            {/* Confidence */}
            <span className="text-[10px] font-mono text-slate-400">
              Confidence: {Math.round(finding.confidence * 100)}%
            </span>
          </div>

          {/* Fingerprint Hash */}
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400 bg-white/[0.02] px-2.5 py-1 rounded-lg border border-white/5 self-start sm:self-auto">
            <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
            <span title={finding.fingerprint}>
              {finding.fingerprint.slice(0, 12)}...
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-white tracking-tight mb-2">
          {finding.title}
        </h3>

        {/* Code Location & Description */}
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mb-3">
          <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-cyan-300 font-medium">{finding.file_path || 'Unknown file'}</span>
          {finding.line_start && (
            <span className="text-slate-400">
              :{finding.line_start}{finding.line_end ? `-${finding.line_end}` : ''}
            </span>
          )}
          {finding.endpoint && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-purple-300">Route: {finding.endpoint}</span>
            </>
          )}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          {finding.description}
        </p>

        {/* Interactive Action Bar (DETECT -> EXPLAIN -> FIX -> VERIFY) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Step 2: Explain Button */}
            <button
              onClick={handleExplain}
              disabled={loadingAction !== null}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                finding.explanation
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  : 'bg-white/5 hover:bg-purple-500/20 text-slate-300 hover:text-purple-200 border-white/10'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
              <span>{loadingAction === 'explain' ? 'Analyzing...' : finding.explanation ? 'Explanation Ready' : '2. Explain (Gemini)'}</span>
            </button>

            {/* Step 3: Propose Fix Button */}
            <button
              onClick={handleProposeDiff}
              disabled={loadingAction !== null}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all border ${
                finding.proposed_diff
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  : 'bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border-white/10'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>{loadingAction === 'fix' ? 'Generating Diff...' : finding.proposed_diff ? 'Patch Proposed' : '3. Propose Fix (Diff)'}</span>
            </button>

            {/* Step 4: Verify with Scanner */}
            {finding.proposed_diff && !isVerified && (
              <button
                onClick={handleVerify}
                disabled={loadingAction !== null}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                <span>{loadingAction === 'verify' ? 'Verifying with isitsecure...' : '4. Verify with Scanner'}</span>
              </button>
            )}

            {/* Dedicated /findings/:id Page Link */}
            <Link
              to={`/findings/${finding.id || finding.fingerprint}`}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all bg-white/5 hover:bg-cyan-500/10 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30"
              title="Open full structured explanation page"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Full Analysis</span>
            </Link>
          </div>

          {/* Toggle Expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <span>{isExpanded ? 'Hide Details' : 'View Code & Details'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 border-t border-white/5 space-y-4 bg-black/20 rounded-b-2xl animate-in fade-in duration-200">
          {/* Code Snippet from AST Scanner */}
          {finding.evidence?.code_snippet && (
            <div>
              <div className="flex items-center space-x-2 mb-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-slate-300 font-mono">Original Vulnerable AST Snippet</span>
              </div>
              <pre className="p-3 rounded-xl bg-[#06080e] border border-white/10 text-xs font-mono text-slate-300 overflow-x-auto max-h-48">
                <code>{finding.evidence.code_snippet}</code>
              </pre>
            </div>
          )}

          {/* Gemini Root Cause & Blast Radius Explanation */}
          {finding.explanation && (
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/25">
              <div className="flex items-center space-x-2 mb-2 text-purple-300 text-xs font-bold font-mono">
                <BrainCircuit className="w-4 h-4 text-purple-400" />
                <span>Gemini Server-Side Architectural Explanation</span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                {finding.explanation}
              </div>
            </div>
          )}

          {/* Proposed Git Unified Diff */}
          {finding.proposed_diff && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-cyan-300 text-xs font-bold font-mono">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  <span>Proposed Git Unified Patch</span>
                </div>
                {!isVerified && (
                  <span className="text-[11px] text-slate-400">
                    Ready to pass through scanner verification rule
                  </span>
                )}
              </div>
              <DiffViewer diffText={finding.proposed_diff} />
            </div>
          )}

          {/* Verification Result from isitsecure */}
          {finding.verification_result && (
            <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-start space-x-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-300 font-mono">
                  Scanner Verdict: {finding.verification_result.engine_verdict}
                </span>
                <p className="text-slate-300 mt-0.5">
                  {finding.verification_result.message}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
