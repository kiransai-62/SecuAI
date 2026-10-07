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
  ListFilter, 
  FileCode2, 
  Clock, 
  Play, 
  Terminal, 
  ChevronRight, 
  ChevronDown, 
  Loader2, 
  ShieldCheck, 
  Wrench,
  BrainCircuit,
  ExternalLink,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { Finding, Severity, FindingStatus } from '../types';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ScoreRing, getScoreLabel } from '../components/ScoreRing';
import { ScanProgressStepper } from '../components/ScanProgressStepper';
import { FindingCard } from '../components/FindingCard';
import { useToast } from '../components/Toast';

export const ScanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filters state
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'VERIFIED'>('ALL');
  const [expandedFingerprint, setExpandedFingerprint] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportJson = async () => {
    if (!id) return;
    try {
      setIsExporting(true);
      await api.downloadScanJson(id);
      toast.success('Scan report exported as JSON');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export scan JSON');
    } finally {
      setIsExporting(false);
    }
  };

  // Poll scan details every 2s while QUEUED or RUNNING
  const {
    data: scanData,
    isLoading: isScanLoading,
    isError: isScanError,
    error: scanError,
    refetch: refetchScan,
  } = useQuery({
    queryKey: ['scan', id],
    queryFn: () => api.getScan(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const st = String(query.state.data?.status || '').toUpperCase();
      return st === 'QUEUED' || st === 'RUNNING' ? 2000 : false;
    },
  });

  // Query findings with ?severity=&status= filters
  const {
    data: findings = [],
    isLoading: isFindingsLoading,
    refetch: refetchFindings,
  } = useQuery({
    queryKey: ['scanFindings', id, severityFilter, statusFilter],
    queryFn: () =>
      api.getScanFindings(id!, {
        severity: severityFilter,
        status: statusFilter,
      }),
    enabled: Boolean(id && scanData?.status?.toUpperCase() === 'COMPLETED'),
  });

  // Retry scan mutation
  const retryMutation = useMutation({
    mutationFn: () => api.retryScan(id!),
    onSuccess: (newScan) => {
      toast.success('Scan re-queued successfully!');
      queryClient.invalidateQueries({ queryKey: ['scan', id] });
      queryClient.invalidateQueries({ queryKey: ['scanFindings', id] });
      if (newScan?.id && newScan.id !== id) {
        navigate(`/scans/${newScan.id}`);
      } else {
        refetchScan();
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to retry scan');
    },
  });

  // Finding remediation mutations
  const explainMutation = useMutation({
    mutationFn: (fingerprint: string) => api.explainFinding(fingerprint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scanFindings', id] });
    },
  });

  const proposeDiffMutation = useMutation({
    mutationFn: (fingerprint: string) => api.proposeDiff(fingerprint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scanFindings', id] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ fingerprint, diff }: { fingerprint: string; diff: string }) =>
      api.verifyFinding(fingerprint, diff),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scanFindings', id] });
      queryClient.invalidateQueries({ queryKey: ['scan', id] });
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
      toast.success('Finding verified successfully!');
    },
  });

  const scan = scanData?.scan;
  const status = String(scanData?.status || scan?.status || 'QUEUED').toUpperCase();
  const isQueuedOrRunning = status === 'QUEUED' || status === 'RUNNING';
  const isFailed = status === 'FAILED';
  const isCompleted = status === 'COMPLETED';

  const counts = scanData?.counts || {
    critical: scan?.critical_count ?? 0,
    high: scan?.high_count ?? 0,
    medium: scan?.medium_count ?? 0,
    low: scan?.low_count ?? 0,
    total: scan?.findings_count ?? 0,
  };

  const score = scanData?.score ?? scan?.security_score ?? 100;

  // Severity rendering: text + dot per minimalist UI spec
  const renderSeverityBadge = (severity: Severity) => {
    const dotColor = {
      CRITICAL: 'bg-red-500',
      HIGH: 'bg-orange-500',
      MEDIUM: 'bg-amber-500',
      LOW: 'bg-blue-500',
      INFO: 'bg-slate-400',
    }[severity] || 'bg-slate-400';

    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
        <span>{severity}</span>
      </span>
    );
  };

  const renderStatusBadge = (findingStatus?: FindingStatus) => {
    const s = String(findingStatus || 'OPEN').toUpperCase();
    if (s === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
          <span>VERIFIED</span>
        </span>
      );
    }
    if (s === 'FIX_PROPOSED' || s === 'patch_proposed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
          <Wrench className="w-3 h-3 text-purple-400" aria-hidden="true" />
          <span>PATCH PROPOSED</span>
        </span>
      );
    }
    if (s === 'REGRESSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono">
          <AlertTriangle className="w-3 h-3 text-rose-400" aria-hidden="true" />
          <span>REGRESSED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
        <CircleDot className="w-3 h-3 text-cyan-400" aria-hidden="true" />
        <span>OPEN</span>
      </span>
    );
  };

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
                id="btn-back-to-project"
                onClick={() =>
                  scan?.project_id
                    ? navigate(`/projects/${scan.project_id}`)
                    : navigate('/dashboard')
                }
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                aria-label="Back to project or dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Link
                  to="/projects"
                  className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                >
                  Projects
                </Link>
                <span>/</span>
                {scan?.project_id ? (
                  <Link
                    to={`/projects/${scan.project_id}`}
                    className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded font-mono"
                  >
                    Project
                  </Link>
                ) : (
                  <span>Project</span>
                )}
                <span>/</span>
                <span className="text-cyan-400 font-medium font-mono">
                  Scan {id?.slice(0, 8)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  refetchScan();
                  if (isCompleted) refetchFindings();
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                title="Refresh scan"
                aria-label="Refresh scan status"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isQueuedOrRunning ? 'animate-spin text-cyan-400' : ''}`}
                />
              </button>

              {isCompleted && (
                <>
                  <button
                    id="btn-export-scan-json"
                    onClick={handleExportJson}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    title="Export Scan Report (JSON)"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>Export JSON</span>
                  </button>

                  <button
                    id="btn-retry-scan-top"
                    onClick={() => retryMutation.mutate()}
                    disabled={retryMutation.isPending}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Scan Again</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Loading scan state */}
          {isScanLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-32 bg-white/5 rounded-3xl border border-white/5" />
              <div className="h-64 bg-white/[0.02] rounded-3xl border border-white/5" />
            </div>
          ) : isScanError ? (
            <div className="p-10 rounded-3xl bg-rose-950/20 border border-rose-500/20 text-center max-w-lg mx-auto space-y-4">
              <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Scan Not Found</h3>
              <p className="text-xs text-rose-300/80">
                {(scanError as Error)?.message || 'Unable to load scan information.'}
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                Return to Dashboard
              </button>
            </div>
          ) : isQueuedOrRunning ? (
            /* STEPPER VIEW WHILE QUEUED / RUNNING (Polled every 2s, aria-live) */
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-gradient-to-r from-cyan-950/20 via-blue-950/10 to-transparent border border-cyan-500/20 backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500" />
                    </span>
                    <div>
                      <h1 className="text-xl font-bold text-white font-mono tracking-tight">
                        Security Scan in Progress
                      </h1>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Target: <span className="font-mono text-cyan-300">{scan?.target_path || 'Project Workspace'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Polling status every 2s</span>
                  </div>
                </div>
              </div>

              {/* Progress Stepper with aria-live="polite" */}
              <ScanProgressStepper
                currentStep={scanData?.progress_step}
                status={status}
                errorMessage={scan?.error}
              />
            </div>
          ) : isFailed ? (
            /* FAILED VIEW: SHOW ERROR MESSAGE + RETRY SCAN BUTTON */
            <div className="p-10 md:p-14 rounded-3xl bg-rose-950/20 border border-rose-500/30 text-center max-w-2xl mx-auto space-y-6 shadow-2xl backdrop-blur-xl">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(244,63,94,0.2)]">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Security Scan Failed
                </h2>
                <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 font-mono text-xs text-rose-300 text-left overflow-x-auto">
                  {scan?.error || 'Execution halted due to an unexpected scanning error.'}
                </div>
                <p className="text-xs text-slate-400">
                  You can retry this scan with the existing configuration or inspect repository settings.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  id="btn-retry-scan"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-black font-semibold text-xs shadow-lg shadow-rose-950/50 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Retry Scan</span>
                </button>

                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* COMPLETED VIEW: SHOW SCORE, SEVERITY COUNTS & FINDINGS TABLE */
            <div className="space-y-6">
              {/* Scan Overview Hero Card */}
              <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left: ScoreRing & Score Grade */}
                  <div className="flex items-center gap-6">
                    <ScoreRing score={score} size="md" />

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                          Security Posture
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          COMPLETED
                        </span>
                      </div>
                      <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        {getScoreLabel(score)} Security Grade
                      </h1>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                          <span>isitsecure subprocess engine</span>
                        </span>
                        {scan?.scan_duration_seconds ? (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Duration: {scan.scan_duration_seconds}s</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Right: Severity Counts Breakdown (Non-color-only) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold font-mono text-rose-300">CRITICAL</span>
                        <ShieldAlert className="w-4 h-4 text-rose-400" aria-hidden="true" />
                      </div>
                      <span className="text-2xl font-black text-rose-200 font-mono mt-1">
                        {counts.critical}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold font-mono text-orange-300">HIGH</span>
                        <AlertTriangle className="w-4 h-4 text-orange-400" aria-hidden="true" />
                      </div>
                      <span className="text-2xl font-black text-orange-200 font-mono mt-1">
                        {counts.high}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold font-mono text-amber-300">MEDIUM</span>
                        <AlertCircle className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      </div>
                      <span className="text-2xl font-black text-amber-200 font-mono mt-1">
                        {counts.medium}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold font-mono text-blue-300">LOW</span>
                        <Info className="w-4 h-4 text-blue-400" aria-hidden="true" />
                      </div>
                      <span className="text-2xl font-black text-blue-200 font-mono mt-1">
                        {counts.low}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters Header: Severity & Status (Keyboard Navigable) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                {/* Severity Filter Tabs */}
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="tablist"
                  aria-label="Filter findings by severity"
                >
                  <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1.5">
                    <ListFilter className="w-3.5 h-3.5" /> Severity:
                  </span>
                  {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) => {
                    const isSelected = severityFilter === sev;
                    return (
                      <button
                        key={sev}
                        id={`filter-severity-${sev.toLowerCase()}`}
                        role="tab"
                        aria-selected={isSelected}
                        tabIndex={0}
                        onClick={() => setSeverityFilter(sev)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          isSelected
                            ? 'bg-cyan-500 text-black shadow-md shadow-cyan-950/50 scale-[1.02]'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
                        }`}
                      >
                        {sev}
                      </button>
                    );
                  })}
                </div>

                {/* Status Filter Tabs */}
                <div
                  className="flex items-center gap-2"
                  role="tablist"
                  aria-label="Filter findings by status"
                >
                  <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1.5">
                    <CircleDot className="w-3.5 h-3.5" /> Status:
                  </span>
                  {(
                    [
                      { id: 'ALL', label: 'All' },
                      { id: 'OPEN', label: 'Open' },
                      { id: 'VERIFIED', label: 'Verified' },
                    ] as const
                  ).map((st) => {
                    const isSelected = statusFilter === st.id;
                    return (
                      <button
                        key={st.id}
                        id={`filter-status-${st.id.toLowerCase()}`}
                        role="tab"
                        aria-selected={isSelected}
                        tabIndex={0}
                        onClick={() => setStatusFilter(st.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                          isSelected
                            ? 'bg-purple-500 text-white shadow-md shadow-purple-950/50 scale-[1.02]'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Findings Table */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden shadow-xl">
                {isFindingsLoading ? (
                  <div className="p-12 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
                    <p className="text-xs text-slate-400">Loading findings...</p>
                  </div>
                ) : findings.length === 0 ? (
                  <div className="p-16 text-center space-y-4">
                    <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-bold text-white">No Findings Match</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      No security issues match your current severity ({severityFilter}) and status ({statusFilter}) filters.
                    </p>
                    <button
                      onClick={() => {
                        setSeverityFilter('ALL');
                        setStatusFilter('ALL');
                      }}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-xs font-semibold font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" role="table">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.01] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Severity</th>
                          <th className="py-3.5 px-4">Title & Category</th>
                          <th className="py-3.5 px-4">File : Line</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Remediation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {findings.map((finding) => {
                          const isExpanded = expandedFingerprint === finding.fingerprint;
                          return (
                            <React.Fragment key={finding.fingerprint}>
                              <tr
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setExpandedFingerprint(
                                      isExpanded ? null : finding.fingerprint
                                    );
                                  }
                                }}
                                className={`group hover:bg-white/[0.03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                                  isExpanded ? 'bg-white/[0.02]' : ''
                                }`}
                              >
                                <td className="py-4 px-4 whitespace-nowrap">
                                  {renderSeverityBadge(finding.severity)}
                                </td>

                                <td className="py-4 px-4">
                                  <Link
                                    to={`/findings/${finding.id || finding.fingerprint}`}
                                    className="font-semibold text-slate-100 hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                                  >
                                    <span>{finding.title}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400" />
                                  </Link>
                                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                    {finding.category} • {finding.source}
                                  </div>
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-mono text-slate-300 text-xs">
                                    <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                                    <span>
                                      {finding.file_path || 'N/A'}
                                      {finding.line_start ? `:${finding.line_start}` : ''}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  {renderStatusBadge(finding.status)}
                                </td>

                                <td className="py-4 px-4 text-right whitespace-nowrap">
                                  <button
                                    id={`btn-inspect-${finding.fingerprint.slice(0, 8)}`}
                                    onClick={() =>
                                      setExpandedFingerprint(
                                        isExpanded ? null : finding.fingerprint
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-cyan-200 border border-white/5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                                    aria-expanded={isExpanded}
                                    aria-label={`Inspect finding ${finding.title}`}
                                  >
                                    <span>{isExpanded ? 'Close' : 'Inspect & Fix'}</span>
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Remediation Loop Panel */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={5} className="p-4 bg-black/40">
                                    <div className="p-2">
                                      <FindingCard
                                        finding={finding}
                                        onExplain={async (fp) => {
                                          await explainMutation.mutateAsync(fp);
                                        }}
                                        onProposeDiff={async (fp) => {
                                          await proposeDiffMutation.mutateAsync(fp);
                                        }}
                                        onVerify={async (fp, diff) => {
                                          await verifyMutation.mutateAsync({
                                            fingerprint: fp,
                                            diff,
                                          });
                                        }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
