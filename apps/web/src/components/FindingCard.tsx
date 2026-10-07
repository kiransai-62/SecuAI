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
          ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
          : isCritical
          ? 'bg-white border-rose-200/80 hover:border-rose-300 shadow-xs'
          : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
      }`}
    >
      {/* Top Banner if verified */}
      {isVerified && (
        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200/80 flex items-center justify-between text-xs text-emerald-700 font-semibold rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Remediation Verified by Scanner: Neutralized</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-700 uppercase bg-emerald-100/60 px-2 py-0.5 rounded border border-emerald-200">
            {finding.verification_result?.scanner_name || 'isitsecure'}
          </span>
        </div>
      )}

      {/* Main Card Header */}
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Severity: Text + Dot */}
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
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
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold">
              {finding.source}
            </span>

            {/* Category Badge */}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60 font-medium">
              {finding.category}
            </span>

            {/* Confidence */}
            <span className="text-[10px] font-mono text-slate-500">
              Confidence: {Math.round(finding.confidence * 100)}%
            </span>
          </div>

          {/* Fingerprint Hash */}
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80 self-start sm:self-auto">
            <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
            <span title={finding.fingerprint}>
              {finding.fingerprint.slice(0, 12)}...
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 tracking-tight mb-2">
          {finding.title}
        </h3>

        {/* Code Location & Description */}
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 mb-3">
          <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-blue-600 font-semibold">{finding.file_path || 'Unknown file'}</span>
          {finding.line_start && (
            <span className="text-slate-500">
              :{finding.line_start}{finding.line_end ? `-${finding.line_end}` : ''}
            </span>
          )}
          {finding.endpoint && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-purple-600 font-medium">Route: {finding.endpoint}</span>
            </>
          )}
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          {finding.description}
        </p>

        {/* Interactive Action Bar (DETECT -> EXPLAIN -> FIX -> VERIFY) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Step 2: Explain Button */}
            <button
              onClick={handleExplain}
              disabled={loadingAction !== null}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                finding.explanation
                  ? 'bg-purple-50 text-purple-700 border-purple-200/80 shadow-2xs'
                  : 'bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border-slate-200/80'
              }`}
            >
              <BrainCircuit className="w-3.5 h-3.5 text-purple-600" />
              <span>{loadingAction === 'explain' ? 'Analyzing...' : finding.explanation ? 'Explanation Ready' : '2. Explain (Gemini)'}</span>
            </button>

            {/* Step 3: Propose Fix Button */}
            <button
              onClick={handleProposeDiff}
              disabled={loadingAction !== null}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                finding.proposed_diff
                  ? 'bg-blue-50 text-blue-700 border-blue-200/80 shadow-2xs'
                  : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200/80'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-blue-600" />
              <span>{loadingAction === 'fix' ? 'Generating Diff...' : finding.proposed_diff ? 'Patch Proposed' : '3. Propose Fix (Diff)'}</span>
            </button>

            {/* Step 4: Verify with Scanner */}
            {finding.proposed_diff && !isVerified && (
              <button
                onClick={handleVerify}
                disabled={loadingAction !== null}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>{loadingAction === 'verify' ? 'Verifying with isitsecure...' : '4. Verify with Scanner'}</span>
              </button>
            )}

            {/* Dedicated /findings/:id Page Link */}
            <Link
              to={`/findings/${finding.id || finding.fingerprint}`}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs"
              title="Open full structured explanation page"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Full Analysis</span>
            </Link>
          </div>

          {/* Toggle Expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span>{isExpanded ? 'Hide Details' : 'View Code & Details'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Details Drawer */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-4 bg-slate-50/50 rounded-b-2xl animate-in fade-in duration-200">
          {/* Code Snippet from AST Scanner */}
          {finding.evidence?.code_snippet && (
            <div>
              <div className="flex items-center space-x-2 mb-1.5">
                <Terminal className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs font-semibold text-slate-700 font-mono">Original Vulnerable AST Snippet</span>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto max-h-48 shadow-inner">
                <code>{finding.evidence.code_snippet}</code>
              </pre>
            </div>
          )}

          {/* Gemini Root Cause & Blast Radius Explanation */}
          {finding.explanation && (
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/80">
              <div className="flex items-center space-x-2 mb-2 text-purple-800 text-xs font-bold font-mono">
                <BrainCircuit className="w-4 h-4 text-purple-600" />
                <span>Gemini Server-Side Architectural Explanation</span>
              </div>
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                {finding.explanation}
              </div>
            </div>
          )}

          {/* Proposed Git Unified Diff */}
          {finding.proposed_diff && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-blue-700 text-xs font-bold font-mono">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <span>Proposed Git Unified Patch</span>
                </div>
                {!isVerified && (
                  <span className="text-[11px] text-slate-500">
                    Ready to pass through scanner verification rule
                  </span>
                )}
              </div>
              <DiffViewer diffText={finding.proposed_diff} />
            </div>
          )}

          {/* Verification Result from isitsecure */}
          {finding.verification_result && (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start space-x-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-800 font-mono">
                  Scanner Verdict: {finding.verification_result.engine_verdict}
                </span>
                <p className="text-slate-700 mt-0.5">
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
