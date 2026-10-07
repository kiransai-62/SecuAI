import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  RefreshCw, 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  CircleDot, 
  FileCode2, 
  Terminal, 
  HelpCircle, 
  History, 
  Zap, 
  Search, 
  Wrench, 
  ShieldCheck, 
  Gauge, 
  Sparkles,
  Check,
  Copy,
  Play,
  Loader2,
  FileDiff
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { Severity, FindingStatus, FindingExplanation } from '../types';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { DiffViewer } from '../components/DiffViewer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ScoreRing } from '../components/ScoreRing';
import { useToast } from '../components/Toast';

export const FindingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [customDiff, setCustomDiff] = useState<string | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [copiedDiff, setCopiedDiff] = useState(false);
  const [latestVerification, setLatestVerification] = useState<any>(null);
  const [scoreOverride, setScoreOverride] = useState<number | null>(null);

  // 1. Fetch Finding Data
  const {
    data: finding,
    isLoading: isFindingLoading,
    isError: isFindingError,
    error: findingError,
    refetch: refetchFinding,
  } = useQuery({
    queryKey: ['finding', id],
    queryFn: () => api.getFinding(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch associated scan to display project/scan score
  const {
    data: scanData,
    refetch: refetchScan,
  } = useQuery({
    queryKey: ['scan', finding?.scan_id],
    queryFn: () => (finding?.scan_id ? api.getScan(finding.scan_id) : null),
    enabled: Boolean(finding?.scan_id),
  });

  const currentScore =
    scoreOverride ??
    scanData?.scan?.security_score ??
    scanData?.scan?.score ??
    (finding?.status === 'VERIFIED' ? 50 : 35);

  // 2. Fetch Gemini Structured Explanation (Cached in ai_analysis)
  const {
    data: explainResponse,
    isLoading: isExplainLoading,
    isError: isExplainError,
    refetch: refetchExplain,
  } = useQuery({
    queryKey: ['findingExplain', id],
    queryFn: () => api.explainFindingDetailed(id!),
    enabled: Boolean(id),
    staleTime: 10 * 60 * 1000, // Instant second view
  });

  // Unified diff state: custom generated or from finding record
  const activeDiff = customDiff ?? (finding?.proposed_fix || finding?.proposed_diff || null);

  // 3. Generate Fix Mutation (POST /api/findings/:id/generate-fix)
  const generateFixMutation = useMutation({
    mutationFn: () => api.generateFix(id!),
    onSuccess: (data) => {
      if (data.success && data.diff) {
        setCustomDiff(data.diff);
        setFixError(null);
        toast.success('Unified fix generated and verified with git apply --check!');
        queryClient.invalidateQueries({ queryKey: ['finding', id] });
      } else {
        setCustomDiff(null);
        setFixError(data.error || 'Failed to generate patch');
        toast.error(data.error || 'Unable to generate valid patch');
      }
    },
    onError: (err: any) => {
      setCustomDiff(null);
      setFixError(err.message || 'Error generating fix');
      toast.error(err.message || 'Failed to generate fix');
    },
  });

  // 4. Apply Fix Mutation (POST /api/findings/:id/apply-fix)
  const applyFixMutation = useMutation({
    mutationFn: () => api.applyFix(id!, activeDiff || undefined),
    onSuccess: (data) => {
      setIsConfirmDialogOpen(false);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
      toast.success(data.message || 'Fix applied to scan workspace!');
      queryClient.invalidateQueries({ queryKey: ['finding', id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to apply fix');
    },
  });

  // 5. Verify Fix Mutation (POST /api/findings/:id/verify)
  const verifyFixMutation = useMutation({
    mutationFn: () => api.verifyFinding(id!, activeDiff || undefined),
    onSuccess: (data) => {
      setLatestVerification(data);
      if (data.scan_metrics?.score !== undefined) {
        setScoreOverride(data.scan_metrics.score);
      } else if (data.scan_metrics?.security_score !== undefined) {
        setScoreOverride(data.scan_metrics.security_score);
      }

      if (data.status === 'VERIFIED') {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 },
        });
        toast.success(data.message || 'Scanner verified: Vulnerability neutralized!');
      } else if (data.status === 'OPEN') {
        toast.error(data.message || 'Vulnerability still present in code.');
      } else {
        toast.info(data.message || 'Scanner verification inconclusive.');
      }

      queryClient.invalidateQueries({ queryKey: ['finding', id] });
      queryClient.invalidateQueries({ queryKey: ['scan', finding?.scan_id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to verify finding');
    },
  });

  // 6. Run Full Re-Scan Mutation
  const reScanMutation = useMutation({
    mutationFn: async () => {
      if (!finding?.scan_id) throw new Error('Scan ID not found');
      return api.reScan(finding.scan_id);
    },
    onSuccess: (newScan) => {
      toast.success('Full re-scan initiated! Worker running verification pass.');
      if (newScan?.id) {
        navigate(`/scans/${newScan.id}`);
      } else if (finding?.scan_id) {
        navigate(`/scans/${finding.scan_id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to initiate full re-scan');
    },
  });

  const handleCopyDiff = () => {
    if (!activeDiff) return;
    navigator.clipboard.writeText(activeDiff);
    setCopiedDiff(true);
    toast.success('Unified diff copied to clipboard');
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  const isLoading = isFindingLoading || isExplainLoading;
  const analysisData = explainResponse?.analysis;
  const isCached = explainResponse?.cached ?? false;

  // Defensive fallback: Malformed model output never crashes UI
  const safeAnalysis: FindingExplanation = {
    summary:
      analysisData?.summary ||
      finding?.title ||
      'A security vulnerability was identified in the analyzed code.',
    why_it_happened:
      analysisData?.why_it_happened ||
      'The code or configuration does not enforce required isolation or validation boundaries.',
    potential_impact:
      analysisData?.potential_impact ||
      'An adversary could exploit this sink to access unauthorized data or execute unauthorized operations.',
    evidence_interpretation:
      analysisData?.evidence_interpretation ||
      'Static analysis identified a pattern matching known vulnerability signatures.',
    recommended_remediation:
      analysisData?.recommended_remediation ||
      'Update the code to validate user permissions, restrict query boundaries, or remove exposed secrets.',
    verification_steps:
      Array.isArray(analysisData?.verification_steps) &&
      analysisData.verification_steps.length > 0
        ? analysisData.verification_steps
        : [
            'Apply the recommended fix to the affected file.',
            'Run automated test suites to ensure no regressions.',
            'Re-run the security scan to verify the issue is resolved.',
          ],
  };

  const renderSeverityBadge = (severity?: Severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            <span>CRITICAL</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider bg-orange-500/15 text-orange-300 border border-orange-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
            <span>HIGH</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>MEDIUM</span>
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Info className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span>LOW</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold font-mono tracking-wider bg-slate-500/15 text-slate-300 border border-slate-500/30">
            <Info className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>INFO</span>
          </span>
        );
    }
  };

  const renderStatusBadge = (status?: FindingStatus) => {
    const s = String(status || 'OPEN').toUpperCase();
    if (s === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span>VERIFIED</span>
        </span>
      );
    }
    if (s === 'FIX_APPLIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
          <span>FIX APPLIED</span>
        </span>
      );
    }
    if (s === 'FIX_PROPOSED' || s === 'PATCH_PROPOSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
          <Wrench className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
          <span>FIX PROPOSED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
        <CircleDot className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
        <span>OPEN</span>
      </span>
    );
  };

  const snippet =
    finding?.evidence?.code_snippet ||
    finding?.evidence?.evidence_text ||
    finding?.description ||
    '';

  return (
    <div className="flex h-screen bg-[#030712] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Breadcrumb Navigation & Top Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                id="btn-back-to-scan"
                onClick={() =>
                  finding?.scan_id
                    ? navigate(`/scans/${finding.scan_id}`)
                    : navigate(-1)
                }
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                aria-label="Back to scan findings"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                >
                  Dashboard
                </Link>
                <span>/</span>
                {finding?.scan_id ? (
                  <>
                    <Link
                      to={`/scans/${finding.scan_id}`}
                      className="hover:text-white transition-colors font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                    >
                      Scan {finding.scan_id.slice(0, 8)}
                    </Link>
                    <span>/</span>
                  </>
                ) : null}
                <span className="text-cyan-400 font-medium font-mono">
                  Finding {id?.slice(0, 8)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isCached && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Instant Cached Analysis</span>
                </span>
              )}

              <button
                onClick={() => {
                  refetchFinding();
                  refetchExplain();
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                title="Refresh analysis"
                aria-label="Refresh finding analysis"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Finding Header Card */}
          {finding ? (
            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {renderSeverityBadge(finding.severity)}
                  {renderStatusBadge(finding.status)}
                  <span className="text-xs font-mono text-slate-400 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                    {finding.category}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-xs font-mono text-slate-400 hidden sm:block">
                    Fingerprint: <span className="text-cyan-300">{finding.fingerprint.slice(0, 12)}...</span>
                  </div>

                  {/* Dynamic ScoreRing with 150ms animation respecting reduced motion */}
                  <div className="flex items-center gap-2 pl-4 border-l border-white/10" title={`Security score: ${currentScore}/100`}>
                    <ScoreRing score={currentScore} size="sm" showLabel={false} />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Score</span>
                      <span className="text-sm font-bold font-mono text-white transition-all duration-150 motion-reduce:transition-none">
                        {currentScore}<span className="text-[10px] text-slate-500">/100</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                {finding.title}
              </h1>

              <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400 font-mono pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {finding.file_path || 'Unknown file'}
                    {finding.line_start ? ` : Line ${finding.line_start}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Scanner: {finding.evidence?.scanner_name || finding.source || 'isitsecure'}</span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Confidence: {Math.round((finding.confidence ?? 1.0) * 100)}%</span>
                </div>
              </div>
            </div>
          ) : isFindingLoading ? (
            <div className="h-36 rounded-3xl bg-white/5 border border-white/5 animate-pulse" />
          ) : isFindingError ? (
            <div className="p-8 rounded-3xl bg-rose-950/20 border border-rose-500/20 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h2 className="text-base font-bold text-white">Finding Not Found</h2>
              <p className="text-xs text-rose-300/80">
                {(findingError as Error)?.message || 'Unable to load finding details.'}
              </p>
            </div>
          ) : null}

          {/* Verification Result Banner: Verified (green) / Still present / Inconclusive */}
          {(() => {
            const currentStatus = String(finding?.status || latestVerification?.status || 'OPEN').toUpperCase();
            const verificationResult = latestVerification?.evidence || finding?.verification_result;
            const evidenceText =
              latestVerification?.message ||
              verificationResult?.message ||
              verificationResult?.evidence_text ||
              '';

            if (currentStatus === 'VERIFIED') {
              return (
                <div
                  id="verification-banner-verified"
                  className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-emerald-950/30 border border-emerald-500/30 text-emerald-100 flex flex-wrap items-center justify-between gap-4 shadow-xl"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                          Verified
                        </span>
                        <span className="text-xs text-emerald-300/80 font-mono">
                          Scanner confirmed patch
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-emerald-100/90 leading-relaxed font-mono">
                        {evidenceText || 'Scanner verified: Vulnerability neutralized and regression checks passed.'}
                      </p>
                    </div>
                  </div>
                  <button
                    id="btn-run-full-rescan-verified"
                    type="button"
                    disabled={reScanMutation.isPending}
                    onClick={() => reScanMutation.mutate()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${reScanMutation.isPending ? 'animate-spin' : ''}`} />
                    <span>Run full re-scan</span>
                  </button>
                </div>
              );
            }

            if (currentStatus === 'OPEN' && (latestVerification || verificationResult?.note === 'still present' || verificationResult?.verdict === 'FAILED')) {
              return (
                <div
                  id="verification-banner-still-present"
                  className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 via-rose-900/20 to-rose-950/30 border border-rose-500/30 text-rose-100 flex flex-wrap items-center justify-between gap-4 shadow-xl"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-9 h-9 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]">
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-500/25 text-rose-300 border border-rose-500/40">
                          Still present
                        </span>
                        <span className="text-xs text-rose-300/80 font-mono">
                          Vulnerability detected by scanner
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-rose-100/90 leading-relaxed font-mono">
                        {evidenceText || 'Vulnerability still present in code: Fix was rejected or did not neutralize the flaw.'}
                      </p>
                    </div>
                  </div>
                  <button
                    id="btn-run-full-rescan-still-present"
                    type="button"
                    disabled={reScanMutation.isPending}
                    onClick={() => reScanMutation.mutate()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold font-mono transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-rose-300 ${reScanMutation.isPending ? 'animate-spin' : ''}`} />
                    <span>Run full re-scan</span>
                  </button>
                </div>
              );
            }

            if (currentStatus === 'INCONCLUSIVE') {
              return (
                <div
                  id="verification-banner-inconclusive"
                  className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-amber-950/30 via-amber-900/15 to-amber-950/20 border border-amber-500/30 text-amber-100 flex flex-wrap items-center justify-between gap-4 shadow-xl"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3.5 max-w-2xl">
                    <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <HelpCircle className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-500/25 text-amber-300 border border-amber-500/40">
                          Inconclusive
                        </span>
                        <span className="text-xs text-amber-300/80 font-mono">
                          Automated check inconclusive
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-amber-100/90 leading-relaxed font-mono">
                        {evidenceText || 'Scanner verification is inconclusive or unsupported for this finding type.'}
                      </p>
                    </div>
                  </div>
                  <button
                    id="btn-run-full-rescan-inconclusive"
                    type="button"
                    disabled={reScanMutation.isPending}
                    onClick={() => reScanMutation.mutate()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${reScanMutation.isPending ? 'animate-spin' : ''}`} />
                    <span>Run full re-scan</span>
                  </button>
                </div>
              );
            }

            return null;
          })()}

          {/* SKELETON WHILE LOADING */}
          {isLoading ? (
            <div className="space-y-6" role="status" aria-label="Loading security analysis">
              {/* Skeleton Section 1 */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3 animate-pulse">
                <div className="h-4 w-44 bg-white/10 rounded-lg" />
                <div className="h-16 bg-white/5 rounded-xl" />
              </div>
              {/* Skeleton Section 2 */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3 animate-pulse">
                <div className="h-4 w-40 bg-white/10 rounded-lg" />
                <div className="h-16 bg-white/5 rounded-xl" />
              </div>
              {/* Skeleton Section 3 */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3 animate-pulse">
                <div className="h-4 w-36 bg-white/10 rounded-lg" />
                <div className="h-16 bg-white/5 rounded-xl" />
              </div>
              {/* Skeleton Section 4 */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3 animate-pulse">
                <div className="h-4 w-32 bg-white/10 rounded-lg" />
                <div className="h-28 bg-white/5 rounded-xl" />
              </div>
              {/* Skeleton Section 5 */}
              <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3 animate-pulse">
                <div className="h-4 w-44 bg-white/10 rounded-lg" />
                <div className="h-20 bg-white/5 rounded-xl" />
              </div>
            </div>
          ) : (
            /* 5 UI SECTIONS IN EXACT ORDER:
               1. What's the problem
               2. Why it happened
               3. Potential impact
               4. Evidence (file, line, scanner, confidence)
               5. Recommended fix
            */
            <div className="space-y-6">
              {/* 1. What's the problem */}
              <section
                aria-labelledby="section-whats-the-problem"
                className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl space-y-3 transition-colors hover:border-cyan-500/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <h2
                    id="section-whats-the-problem"
                    className="text-base font-bold text-white tracking-tight"
                  >
                    1. What's the problem
                  </h2>
                </div>

                <p className="text-xs md:text-sm text-slate-300 leading-relaxed pl-10">
                  {safeAnalysis.summary}
                </p>
              </section>

              {/* 2. Why it happened */}
              <section
                aria-labelledby="section-why-it-happened"
                className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl space-y-3 transition-colors hover:border-purple-500/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <h2
                    id="section-why-it-happened"
                    className="text-base font-bold text-white tracking-tight"
                  >
                    2. Why it happened
                  </h2>
                </div>

                <p className="text-xs md:text-sm text-slate-300 leading-relaxed pl-10">
                  {safeAnalysis.why_it_happened}
                </p>
              </section>

              {/* 3. Potential impact */}
              <section
                aria-labelledby="section-potential-impact"
                className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl space-y-3 transition-colors hover:border-rose-500/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h2
                    id="section-potential-impact"
                    className="text-base font-bold text-white tracking-tight"
                  >
                    3. Potential impact
                  </h2>
                </div>

                <p className="text-xs md:text-sm text-slate-300 leading-relaxed pl-10">
                  {safeAnalysis.potential_impact}
                </p>
              </section>

              {/* 4. Evidence (file, line, scanner, confidence) */}
              <section
                aria-labelledby="section-evidence"
                className="p-6 md:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl space-y-5 transition-colors hover:border-amber-500/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Search className="w-4 h-4" />
                  </div>
                  <h2
                    id="section-evidence"
                    className="text-base font-bold text-white tracking-tight"
                  >
                    4. Evidence
                  </h2>
                </div>

                <p className="text-xs md:text-sm text-slate-300 leading-relaxed pl-10">
                  {safeAnalysis.evidence_interpretation}
                </p>

                {/* Evidence Metrics Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-10">
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      File Path
                    </span>
                    <div className="font-mono text-xs text-white truncate" title={finding?.file_path || 'N/A'}>
                      {finding?.file_path || 'N/A'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Line Number
                    </span>
                    <div className="font-mono text-xs text-white">
                      {finding?.line_start ? `Line ${finding.line_start}` : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Scanner Name
                    </span>
                    <div className="font-mono text-xs text-cyan-300">
                      {finding?.evidence?.scanner_name || finding?.source || 'isitsecure'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Confidence
                    </span>
                    <div className="font-mono text-xs text-emerald-400">
                      {Math.round((finding?.confidence ?? 1.0) * 100)}%
                    </div>
                  </div>
                </div>

                {/* Evidence Code Snippet */}
                {snippet && (
                  <div className="pl-10 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Detected Code Snippet:</span>
                      <span>{finding?.file_path || 'source'}</span>
                    </div>
                    <pre className="p-4 rounded-2xl bg-black/60 border border-white/5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed selection:bg-cyan-500/30">
                      <code>{snippet}</code>
                    </pre>
                  </div>
                )}
              </section>

              {/* 5. Recommended fix */}
              <section
                aria-labelledby="section-recommended-fix"
                className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-emerald-950/20 via-white/[0.02] to-transparent border border-emerald-500/20 shadow-xl space-y-6"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <h2
                    id="section-recommended-fix"
                    className="text-base font-bold text-white tracking-tight"
                  >
                    5. Recommended fix
                  </h2>
                </div>

                <p className="text-xs md:text-sm text-slate-300 leading-relaxed pl-10">
                  {safeAnalysis.recommended_remediation}
                </p>

                {/* Actionable Verification Steps */}
                <div className="pl-10 space-y-3">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                    Verification Steps:
                  </h3>
                  <div className="space-y-2">
                    {safeAnalysis.verification_steps.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300"
                      >
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-mono font-bold">
                          {index + 1}
                        </div>
                        <span className="leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automated Git Remediation Patch Section */}
                <div className="pl-10 pt-4 border-t border-white/5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileDiff className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                          Automated Git Patch (Unified Format)
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Applies to the scan workspace for verification. Copy the diff into your own code.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Generate fix button */}
                      <button
                        id="btn-generate-fix"
                        type="button"
                        disabled={generateFixMutation.isPending}
                        onClick={() => generateFixMutation.mutate()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold font-mono transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      >
                        {generateFixMutation.isPending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Validating with git apply...</span>
                          </>
                        ) : (
                          <>
                            <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{activeDiff ? 'Re-generate fix' : 'Generate fix'}</span>
                          </>
                        )}
                      </button>

                      {/* Copy diff button - ONLY if diff exists */}
                      {activeDiff && (
                        <button
                          id="btn-copy-diff"
                          type="button"
                          onClick={handleCopyDiff}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                        >
                          {copiedDiff ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copy diff</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Apply fix button - ONLY shown when valid diff exists ("invalid diff never shows an Apply button") */}
                      {activeDiff && (
                        <button
                          id="btn-apply-fix"
                          type="button"
                          disabled={applyFixMutation.isPending}
                          onClick={() => setIsConfirmDialogOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        >
                          {applyFixMutation.isPending ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                              <span>Applying...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                              <span>Apply fix</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Verify fix button - runs scanner verification */}
                      {activeDiff && (
                        <button
                          id="btn-verify-fix"
                          type="button"
                          disabled={verifyFixMutation.isPending}
                          onClick={() => verifyFixMutation.mutate()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)] disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                        >
                          {verifyFixMutation.isPending ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                              <span>Verifying with scanner...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
                              <span>Verify fix</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Honest friendly error if patch generation failed */}
                  {fixError && (
                    <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold font-mono">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Could not generate an automated patch passing git apply</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed pl-6">
                        {fixError}
                      </p>
                      <p className="text-[11px] text-slate-400 pl-6">
                        The plain-language explanation and manual verification steps above remain available.
                      </p>
                    </div>
                  )}

                  {/* DiffViewer rendering monospace git unified diff */}
                  {activeDiff && (
                    <div className="space-y-2">
                      <DiffViewer diffText={activeDiff} />
                    </div>
                  )}
                </div>

                {/* Confirm Dialog for Apply Fix */}
                <ConfirmDialog
                  isOpen={isConfirmDialogOpen}
                  title="Apply Fix to Scan Workspace?"
                  message="Applies to the scan workspace for verification. Copy the diff into your own code."
                  confirmLabel="Apply Fix"
                  cancelLabel="Cancel"
                  isDanger={false}
                  isLoading={applyFixMutation.isPending}
                  onConfirm={() => applyFixMutation.mutate()}
                  onCancel={() => setIsConfirmDialogOpen(false)}
                />
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
