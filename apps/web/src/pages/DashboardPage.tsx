import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  FolderGit2, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Play, 
  ArrowRight, 
  Clock, 
  Terminal, 
  CheckCircle2, 
  ExternalLink, 
  FileArchive, 
  RefreshCw,
  Loader2,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { Scan, Project, Severity } from '../types';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ScoreRing, getScoreLabel } from '../components/ScoreRing';
import { ScoreTimelineChart } from '../components/ScoreTimelineChart';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [isDemoRunning, setIsDemoRunning] = useState(false);

  // 1. Fetch user projects
  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    refetch: refetchProjects,
  } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  // 2. Fetch user scans
  const {
    data: scans = [],
    isLoading: isScansLoading,
    refetch: refetchScans,
  } = useQuery<Scan[]>({
    queryKey: ['scans'],
    queryFn: () => api.getAllScans(),
  });

  // Re-scan mutation
  const reScanMutation = useMutation({
    mutationFn: () => api.reScan(),
    onSuccess: (newScan) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Security re-scan completed successfully!');
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#10b981', '#a855f7'],
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to trigger scan');
    },
  });

  const isLoading = isProjectsLoading || isScansLoading;
  const isEmpty = !isLoading && projects.length === 0 && scans.length === 0;

  // Latest scan data
  const latestScan = scans.length > 0 ? scans[0] : null;
  const latestScore = latestScan?.security_score ?? 100;
  const latestCounts = {
    critical: latestScan?.critical_count ?? 0,
    high: latestScan?.high_count ?? 0,
    medium: latestScan?.medium_count ?? 0,
    low: latestScan?.low_count ?? 0,
    total: latestScan?.findings_count ?? 0,
  };

  // Autonomous one-click demo run
  const handleRunFullDemo = async () => {
    if (isDemoRunning) return;
    setIsDemoRunning(true);
    try {
      const findings = await api.getScanFindings('scan-demo-001');
      for (const finding of findings) {
        if (finding.status !== 'VERIFIED') {
          await api.explainFinding(finding.fingerprint);
          await new Promise((r) => setTimeout(r, 400));
          const diff = await api.proposeDiff(finding.fingerprint);
          await new Promise((r) => setTimeout(r, 400));
          await api.verifyFinding(finding.fingerprint, diff);
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      await api.reScan();
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
      });
      toast.success('All demo findings autonomously neutralized & verified!');
    } catch (e: any) {
      toast.error(e.message || 'Autonomous demo execution failed');
    } finally {
      setIsDemoRunning(false);
    }
  };

  // Helper for status badge
  const renderScanStatusBadge = (st: string) => {
    const status = st.toUpperCase();
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
          <span>COMPLETED</span>
        </span>
      );
    }
    if (status === 'RUNNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
          <Loader2 className="w-3 h-3 text-blue-600 animate-spin" aria-hidden="true" />
          <span>RUNNING</span>
        </span>
      );
    }
    if (status === 'QUEUED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 font-mono">
          <Clock className="w-3 h-3 text-amber-600" aria-hidden="true" />
          <span>QUEUED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
        <AlertTriangle className="w-3 h-3 text-rose-600" aria-hidden="true" />
        <span>FAILED</span>
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8FAFD] text-slate-800 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          {/* Top Title & "New Project" CTA Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Security Overview
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Real-time security posture, vulnerability findings & autonomous scanner verification.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  refetchProjects();
                  refetchScans();
                }}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Refresh dashboard"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <Link
                to="/projects/new"
                id="btn-new-project-dashboard"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>New project</span>
              </Link>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-44 bg-slate-200/60 rounded-3xl border border-slate-200/60" />
              <div className="h-64 bg-slate-200/40 rounded-3xl border border-slate-200/60" />
            </div>
          ) : isEmpty ? (
            /* EMPTY STATE: "No projects or scans yet" */
            <div className="p-12 md:p-16 rounded-3xl bg-white border border-slate-200/80 text-center max-w-xl mx-auto space-y-6 shadow-xs">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                <FolderGit2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  No Security Projects Yet
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Start scanning your repositories for RLS misconfigurations, leaked API secrets, and broken access controls. Upload a ZIP archive or connect a GitHub repository.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  to="/projects/new"
                  id="btn-empty-new-project"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Create First Project</span>
                </Link>

                <button
                  onClick={() => navigate('/new-scan')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 text-xs font-semibold shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Start Security Scan</span>
                </button>
              </div>
            </div>
          ) : (
            /* POPULATED STATE: LATEST SCORE + SEVERITY COUNTS + RECENT SCANS */
            <div className="space-y-8">
              {/* Section 1: Latest Security Score & Severity Counts Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Latest Score Card with ScoreRing */}
                <div className="lg:col-span-5 p-6 md:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Latest Security Posture
                    </span>
                    {latestScan && renderScanStatusBadge(latestScan.status)}
                  </div>

                  <div className="flex items-center gap-6">
                    <ScoreRing score={latestScore} size="lg" />

                    <div className="space-y-1.5">
                      <div className="text-xs font-mono text-blue-600 uppercase tracking-widest font-semibold">
                        Grade Status
                      </div>
                      <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {getScoreLabel(latestScore)}
                      </div>
                      <p className="text-xs text-slate-500">
                        {latestScore >= 90
                          ? 'Zero critical vulnerabilities detected.'
                          : latestScore >= 75
                          ? 'Few minor findings to resolve.'
                          : 'Action required: High-risk vulnerabilities found.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono">
                    {latestScan ? (
                      <>
                        <span className="truncate max-w-[200px]">
                          Target: {latestScan.target_path}
                        </span>
                        <Link
                          to={`/scans/${latestScan.id}`}
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                        >
                          <span>View Scan Details</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </>
                    ) : (
                      <span>No active scans recorded.</span>
                    )}
                  </div>
                </div>

                {/* Severity Counts Breakdown Cards (Never color-only) */}
                <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                  {/* Critical Card */}
                  <div className="p-5 rounded-3xl bg-rose-50/70 border border-rose-200/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
                        <span>CRITICAL</span>
                      </span>
                      <span className="text-xs text-rose-600/90 font-mono font-medium">-25 pts ea.</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-slate-900 font-mono">
                        {latestCounts.critical}
                      </div>
                      <p className="text-xs text-rose-700/80 mt-1 font-medium">
                        High-risk RLS & secret leaks
                      </p>
                    </div>
                  </div>

                  {/* High Card */}
                  <div className="p-5 rounded-3xl bg-orange-50/70 border border-orange-200/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-600" aria-hidden="true" />
                        <span>HIGH</span>
                      </span>
                      <span className="text-xs text-orange-600/90 font-mono font-medium">-15 pts ea.</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-slate-900 font-mono">
                        {latestCounts.high}
                      </div>
                      <p className="text-xs text-orange-700/80 mt-1 font-medium">
                        IDOR & unauthenticated routes
                      </p>
                    </div>
                  </div>

                  {/* Medium Card */}
                  <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        <span>MEDIUM</span>
                      </span>
                      <span className="text-xs text-amber-600/90 font-mono font-medium">-7 pts ea.</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-slate-900 font-mono">
                        {latestCounts.medium}
                      </div>
                      <p className="text-xs text-amber-700/80 mt-1 font-medium">
                        Permissive CORS & weak guards
                      </p>
                    </div>
                  </div>

                  {/* Low Card */}
                  <div className="p-5 rounded-3xl bg-blue-50/70 border border-blue-200/80 flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                        <Info className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                        <span>LOW</span>
                      </span>
                      <span className="text-xs text-blue-600/90 font-mono font-medium">-2 pts ea.</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-slate-900 font-mono">
                        {latestCounts.low}
                      </div>
                      <p className="text-xs text-blue-700/80 mt-1 font-medium">
                        Headers & configuration warnings
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Score Timeline Chart */}
              {scans.length > 0 && (
                <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        Security Score Timeline
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      Tracking posture across {scans.length} scan{scans.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <ScoreTimelineChart scans={scans} />
                </div>
              )}

              {/* Section 2: Recent Scans History Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Recent Scans
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Total: {scans.length} scan{scans.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-xs">
                  {scans.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No recent scans recorded.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse" role="table">
                        <thead>
                          <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Target / Project</th>
                            <th className="py-3 px-4">Security Score</th>
                            <th className="py-3 px-4">Severity Breakdown</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {scans.slice(0, 10).map((s) => {
                            const sc = s.security_score ?? 100;
                            const grade = getScoreLabel(sc);
                            const crit = s.critical_count ?? 0;
                            const hgh = s.high_count ?? 0;
                            const med = s.medium_count ?? 0;
                            const low = s.low_count ?? 0;

                            return (
                              <tr
                                key={s.id}
                                className="hover:bg-slate-50/80 transition-colors group"
                              >
                                <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-600">
                                  {new Date(s.created_at).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>

                                <td className="py-4 px-4">
                                  <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors font-mono">
                                    {s.target_path}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono">
                                    ID: {s.id.slice(0, 8)}
                                  </div>
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900 text-sm">
                                      {sc}/100
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                        sc >= 90
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : sc >= 75
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : sc >= 50
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      }`}
                                    >
                                      {grade}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                                      {crit} CRIT
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-bold">
                                      {hgh} HIGH
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                                      {med} MED
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                                      {low} LOW
                                    </span>
                                  </div>
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  {renderScanStatusBadge(s.status)}
                                </td>

                                <td className="py-4 px-4 text-right whitespace-nowrap">
                                  <Link
                                    to={`/scans/${s.id}`}
                                    id={`btn-view-scan-${s.id.slice(0, 8)}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-2xs text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    aria-label={`View scan details for ${s.id}`}
                                  >
                                    <span>View Scan</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: One-click Autonomous Demo Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 border border-blue-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900 font-mono">
                      Autonomous AppSec Remediation Loop
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                    Test the complete closed feedback loop (DETECT → EXPLAIN → FIX → VERIFY → RE-SCAN) with live scanner execution.
                  </p>
                </div>

                <button
                  onClick={handleRunFullDemo}
                  disabled={isDemoRunning}
                  className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isDemoRunning
                      ? 'bg-blue-100 text-blue-700 border border-blue-200 cursor-wait'
                      : 'bg-slate-950 hover:bg-slate-800 text-white shadow-sm'
                  }`}
                >
                  <Play className={`w-4 h-4 fill-current ${isDemoRunning ? 'animate-pulse' : ''}`} />
                  <span>{isDemoRunning ? 'Executing Loop...' : 'Run Autonomous Demo'}</span>
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
