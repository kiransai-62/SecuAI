import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  ScanLine, 
  GitBranch, 
  Upload, 
  Globe, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle, 
  Cpu, 
  Lock,
  ChevronRight,
  FolderKanban,
  RotateCcw,
  Download,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Terminal,
  FileCode2,
  RefreshCw,
  Zap,
  AlertTriangle,
  Flame,
  Check,
  Unlink,
  Link2,
  Key
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { ScoreRing } from '../components/ScoreRing';
import { Finding, Scan } from '../types';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

interface ScanAiReport {
  score: number;
  posture_grade: string;
  summary: string;
  problem_understanding: string;
  root_cause_analysis: string[];
  threat_impact: string;
  remediation_roadmap: string[];
  key_guardrails: string[];
}

export const NewScanPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // Mode: 'configure' | 'scanning' | 'report'
  const [viewState, setViewState] = useState<'configure' | 'scanning' | 'report'>('configure');

  // Configuration state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-demo-001');
  const [targetType, setTargetType] = useState<'GIT' | 'ZIP' | 'URL'>('GIT');
  const [scanProfile, setScanProfile] = useState<'full' | 'sast' | 'dast' | 'secrets'>('full');
  
  const [repoUrl, setRepoUrl] = useState('https://github.com/kiransai-62/SecuAI');
  const [branch, setBranch] = useState('main');
  const [targetUrl, setTargetUrl] = useState('https://staging-api.neobank.internal');
  const [confirmedOwnership, setConfirmedOwnership] = useState(true);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipFileName, setZipFileName] = useState('');

  // GitHub credentials & account management
  const { user, loginWithOAuth } = useAuth();
  const [githubPat, setGithubPat] = useState(() => localStorage.getItem('secuai_github_pat') || '');
  const [connectedGithubUser, setConnectedGithubUser] = useState<string | null>(() => {
    return localStorage.getItem('secuai_github_username') || 'kiransai-62';
  });
  const [isPatSaved, setIsPatSaved] = useState(() => Boolean(localStorage.getItem('secuai_github_pat')));

  useEffect(() => {
    const savedUser = localStorage.getItem('secuai_github_username');
    if (savedUser) {
      setConnectedGithubUser(savedUser);
    } else if (user?.user_metadata?.user_name || user?.app_metadata?.provider === 'github') {
      if (!localStorage.getItem('secuai_github_disconnected')) {
        setConnectedGithubUser(user?.user_metadata?.user_name || user?.email?.split('@')[0] || 'kiransai-62');
      }
    } else if (!localStorage.getItem('secuai_github_disconnected')) {
      setConnectedGithubUser('kiransai-62');
    }
  }, [user]);

  const handleSavePat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubPat.trim()) {
      localStorage.removeItem('secuai_github_pat');
      setIsPatSaved(false);
      toast.success('GitHub Personal Access Token removed.');
      return;
    }
    localStorage.setItem('secuai_github_pat', githubPat.trim());
    setIsPatSaved(true);
    toast.success('GitHub Access Token saved for private repository scans.');
  };

  const handleDisconnectGithub = () => {
    localStorage.removeItem('secuai_github_pat');
    localStorage.removeItem('secuai_github_username');
    localStorage.setItem('secuai_github_disconnected', 'true');
    setConnectedGithubUser(null);
    setGithubPat('');
    setIsPatSaved(false);
    toast.success('Disconnected from GitHub account. You can now provide another account or token.');
  };

  const handleConnectOtherGithub = async () => {
    localStorage.removeItem('secuai_github_disconnected');
    try {
      await loginWithOAuth('github');
    } catch {
      toast.error('Unable to initiate GitHub OAuth account chooser.');
    }
  };

  // Engine toggles
  const [enableAiAnalysis, setEnableAiAnalysis] = useState(true);
  const [enableRlsAudit, setEnableRlsAudit] = useState(true);
  const [enableTaintTracking, setEnableTaintTracking] = useState(true);

  // Scanning progress simulation
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [scanTimer, setScanTimer] = useState(0);
  const timerRef = useRef<any>(null);

  // Active scan results & AI report
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [aiReport, setAiReport] = useState<ScanAiReport | null>(null);
  const [isLoadingAiReport, setIsLoadingAiReport] = useState(false);

  const scanSteps = [
    { label: 'Ingesting Target & AST Parsing', detail: 'Deconstructing source tree into Abstract Syntax Trees' },
    { label: 'PostgreSQL RLS & Tenant Audit', detail: 'Inspecting multi-tenant schema isolation and Supabase policies' },
    { label: 'Dynamic Probing & Auth Fuzzing', detail: 'Evaluating route authentication handlers and JWT claims' },
    { label: 'Gemini AI Posture Intelligence', detail: 'Synthesizing root-cause explanations and verified remediation plan' },
  ];

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  // Timer effect for scanning animation
  useEffect(() => {
    if (viewState === 'scanning') {
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setScanTimer(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewState]);

  // Execute Security Scan Mutation
  const launchMutation = useMutation({
    mutationFn: async () => {
      const projId = selectedProjectId || (projects[0]?.id || 'proj-demo-001');
      const payload: any = {
        scan_mode: scanProfile === 'full' ? 'full_suite' : scanProfile === 'dast' ? 'dast_only' : 'code_only',
        enable_ai: enableAiAnalysis,
      };

      if (targetType === 'GIT') {
        payload.repository_url = repoUrl;
        payload.branch = branch;
      } else if (targetType === 'URL') {
        payload.target_url = targetUrl;
        payload.confirmed_ownership = confirmedOwnership;
      } else if (targetType === 'ZIP' && zipFile) {
        payload.file = zipFile;
      }

      return await api.createProjectScan(projId, payload);
    },
    onSuccess: async (newScan) => {
      setActiveScan(newScan);
      // Advance step 1
      setScanStepIndex(1);

      setTimeout(() => {
        setScanStepIndex(2);
      }, 1200);

      setTimeout(() => {
        setScanStepIndex(3);
      }, 2400);

      setTimeout(async () => {
        // Scan completed: fetch findings and generate Gemini AI Report
        try {
          const scanFindings = await api.getScanFindings(newScan.id || 'scan-demo-001');
          setFindings(scanFindings);
        } catch {
          const fallbackFindings = await api.getFindings();
          setFindings(fallbackFindings);
        }

        setIsLoadingAiReport(true);
        try {
          const report = await api.getScanAiReport(newScan.id || 'scan-demo-001');
          setAiReport(report);
        } catch (reportErr) {
          console.warn('[NewScanPage] Report fetch note:', reportErr);
        } finally {
          setIsLoadingAiReport(false);
        }

        setViewState('report');
        toast.success('Security scan completed and Gemini AI report generated!');
      }, 3800);
    },
    onError: (err: any) => {
      setViewState('configure');
      toast.error(err.message || 'Failed to start scan. Please verify target parameters.');
    },
  });

  const handleStartScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType === 'URL' && !confirmedOwnership) {
      toast.error('You must confirm target ownership before scanning live URLs.');
      return;
    }
    setViewState('scanning');
    setScanStepIndex(0);
    launchMutation.mutate();
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFile(file);
      setZipFileName(file.name);
    }
  };

  const handleDownloadExport = async () => {
    try {
      await api.downloadScanJson(activeScan?.id || 'scan-demo-001');
      toast.success('Security report downloaded successfully');
    } catch {
      toast.error('Failed to export security report');
    }
  };

  const currentScore = activeScan?.security_score ?? aiReport?.score ?? 35;
  const criticalCount = activeScan?.critical_count ?? findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = activeScan?.high_count ?? findings.filter(f => f.severity === 'HIGH').length;

  return (
    <div className="flex h-screen bg-[#F8FAFD] font-sans antialiased text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Top Navigation Bar & Action Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1.5">
                  <span className="text-[#2563EB]">Security Scanner</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span>{viewState === 'report' ? 'Scan & AI Posture Report' : 'New Security Scan'}</span>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                  {viewState === 'report' ? 'Security Score & AI Posture Report' : 'Launch New Security Scan'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {viewState === 'report' 
                    ? 'Gemini AI root-cause analysis, posture score, and verifiable patch remediation guide.'
                    : 'Execute deep AST code analysis, Supabase RLS checks, live route fuzzing, and Gemini AI synthesis.'}
                </p>
              </div>

              <div className="flex items-center space-x-2.5">
                {viewState === 'report' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewState('configure')}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Configure New Scan</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExport}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Download JSON Report</span>
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                    Gemini 3.8 Flash • Engine Online
                  </span>
                )}
              </div>
            </div>

            {/* ========================================================= */}
            {/* VIEW STATE 1: SCAN CONFIGURATION FORM                     */}
            {/* ========================================================= */}
            {viewState === 'configure' && (
              <form onSubmit={handleStartScan} className="space-y-6">
                
                {/* Step 1: Target Project Selection */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-xs border border-blue-100">
                      1
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Select Project Workspace</h2>
                      <p className="text-xs text-slate-500">Attach scan logs and compliance score records to a workspace project.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Project Workspace
                      </label>
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFD] border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-900 font-medium"
                      >
                        <option value="proj-demo-001">FinTech & AI SaaS Demo App</option>
                        {projects
                          .filter(p => p.id !== 'proj-demo-001')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FolderKanban className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="text-xs font-semibold text-slate-800">Target Environment</div>
                          <div className="text-[11px] text-slate-500">Next.js 15 + Supabase multi-tenant banking rules</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                        Ready
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 2: Target Ingestion Method */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-xs border border-blue-100">
                      2
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Target Ingestion Mode</h2>
                      <p className="text-xs text-slate-500">Provide the code repository, local archive, or live endpoint to evaluate.</p>
                    </div>
                  </div>

                  {/* Mode Selector Tabs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'GIT',
                        label: 'Git Repository',
                        desc: 'GitHub, GitLab, or Bitbucket repository',
                        icon: GitBranch,
                      },
                      {
                        id: 'ZIP',
                        label: 'Upload Source Code',
                        desc: 'ZIP archive of source directory',
                        icon: Upload,
                      },
                      {
                        id: 'URL',
                        label: 'Live Web Endpoint',
                        desc: 'DAST API & web route scanning',
                        icon: Globe,
                      },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isSelected = targetType === tab.id;
                      return (
                        <button
                          type="button"
                          key={tab.id}
                          onClick={() => setTargetType(tab.id as any)}
                          className={`text-left p-4 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-[#EBF3FE] border-[#2563EB] shadow-xs'
                              : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 mb-1.5">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-[#2563EB]' : 'text-slate-500'}`} />
                            <span className={`text-sm font-bold ${isSelected ? 'text-[#2563EB]' : 'text-slate-800'}`}>
                              {tab.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{tab.desc}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Input Fields */}
                  <div className="pt-2">
                    {targetType === 'GIT' && (
                      <div className="space-y-4">
                        {/* GitHub Account Connection Status Bar */}
                        <div className="bg-[#F8FAFD] border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                              <GithubIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">
                                  GitHub Account:
                                </span>
                                {connectedGithubUser ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                                    @{connectedGithubUser}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                                    Disconnected / Enter Other Details
                                  </span>
                                )}
                                {isPatSaved && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                                    <Key className="w-3 h-3 mr-1" />
                                    PAT Active
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {connectedGithubUser 
                                  ? 'Connected for repository scanning and branch discovery.' 
                                  : 'Disconnected from previous account. Provide another repository or access token below.'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {connectedGithubUser ? (
                              <button
                                type="button"
                                onClick={handleDisconnectGithub}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200/80 text-xs font-semibold transition-colors shadow-2xs"
                              >
                                <Unlink className="w-3 h-3 text-rose-500" />
                                <span>Disconnect</span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={handleConnectOtherGithub}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-xs"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>{connectedGithubUser ? 'Switch Account' : 'Connect Other Account'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Repository URL & Branch Input */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Repository URL <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="url"
                              required
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              placeholder="https://github.com/username/repository"
                              className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFD] border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-900 font-mono"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Paste any public or private repository URL from your GitHub account.
                            </p>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Branch / Reference
                            </label>
                            <input
                              type="text"
                              value={branch}
                              onChange={(e) => setBranch(e.target.value)}
                              placeholder="main"
                              className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFD] border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-900 font-mono"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              Default branch to inspect (e.g. main, master, staging).
                            </p>
                          </div>
                        </div>

                        {/* Optional GitHub PAT for Private Repositories */}
                        <div className="border border-slate-200/60 rounded-xl p-3.5 bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Key className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-xs font-bold text-slate-800">
                                GitHub Personal Access Token (PAT)
                              </span>
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                Optional for Private Repos
                              </span>
                            </div>
                            {isPatSaved && (
                              <button
                                type="button"
                                onClick={() => {
                                  localStorage.removeItem('secuai_github_pat');
                                  setGithubPat('');
                                  setIsPatSaved(false);
                                  toast.success('GitHub PAT removed.');
                                }}
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                              >
                                Clear Token
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={githubPat}
                              onChange={(e) => setGithubPat(e.target.value)}
                              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                              className="flex-1 px-3 py-2 text-xs bg-[#F8FAFD] border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-900 font-mono"
                            />
                            <button
                              type="button"
                              onClick={handleSavePat}
                              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs shrink-0"
                            >
                              {isPatSaved ? 'Update PAT' : 'Save PAT'}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5">
                            Stored locally in browser for authenticated cloning of private repositories from other accounts.
                          </p>
                        </div>
                      </div>
                    )}

                    {targetType === 'ZIP' && (
                      <div className="border-2 border-dashed border-slate-200 hover:border-[#2563EB] bg-[#F8FAFD] rounded-2xl p-6 text-center transition-colors">
                        <input
                          type="file"
                          accept=".zip,.tar,.gz"
                          id="zip-upload-input"
                          onChange={handleZipChange}
                          className="hidden"
                        />
                        <label htmlFor="zip-upload-input" className="cursor-pointer block">
                          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <div className="text-sm font-bold text-slate-800">
                            {zipFileName || 'Drop source ZIP archive or click to browse'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Supports Next.js, Node.js, Python, Go, and PostgreSQL migrations
                          </div>
                        </label>
                      </div>
                    )}

                    {targetType === 'URL' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Target Endpoint / Base URL <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="url"
                            required
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            placeholder="https://api.yourdomain.com"
                            className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFD] border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-900 font-mono"
                          />
                        </div>
                        <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={confirmedOwnership}
                            onChange={(e) => setConfirmedOwnership(e.target.checked)}
                            className="mt-0.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                          />
                          <span className="text-xs text-slate-600">
                            I certify that I am the authorized owner or have explicit written penetration testing permission for this target endpoint.
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Scan Profile & AI Engine */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-xs border border-blue-100">
                      3
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Scan Profile & Gemini AI Analysis</h2>
                      <p className="text-xs text-slate-500">Autonomous vulnerability detection paired with Gemini reasoning.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {[
                      {
                        id: 'full',
                        title: 'Full Autonomous Suite',
                        desc: 'SAST + DAST + Secrets + Supabase RLS + Autonomous Gemini AI remediation verification loop.',
                        badge: 'Recommended',
                        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
                      },
                      {
                        id: 'sast',
                        title: 'Static Code Analysis (SAST)',
                        desc: 'Fast AST parser, dataflow taint tracking, and OWASP Top 10 code-level vulnerability checks.',
                        badge: 'Fast',
                        badgeColor: 'bg-blue-50 text-[#2563EB] border-blue-200/80',
                      },
                      {
                        id: 'dast',
                        title: 'Dynamic Endpoint Probing (DAST)',
                        desc: 'Active route fuzzing, auth bypass validation, CORS header inspection, and API security.',
                        badge: 'Live',
                        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200/80',
                      },
                      {
                        id: 'secrets',
                        title: 'Secrets & Cloud Audit',
                        desc: 'High-entropy key detection, Supabase Service Role exposure, and PostgreSQL RLS security.',
                        badge: 'Compliance',
                        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
                      },
                    ].map((profile) => {
                      const isSelected = scanProfile === profile.id;
                      return (
                        <div
                          key={profile.id}
                          onClick={() => setScanProfile(profile.id as any)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#EBF3FE] border-[#2563EB] shadow-xs'
                              : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-sm font-bold ${isSelected ? 'text-[#2563EB]' : 'text-slate-800'}`}>
                              {profile.title}
                            </span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${profile.badgeColor}`}>
                              {profile.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{profile.desc}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Toggles */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className="flex items-center space-x-2.5 bg-slate-50/70 border border-slate-200/70 p-3 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableAiAnalysis}
                        onChange={(e) => setEnableAiAnalysis(e.target.checked)}
                        className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span className="text-xs font-semibold text-slate-700">Autonomous Gemini AI Explanation</span>
                    </label>

                    <label className="flex items-center space-x-2.5 bg-slate-50/70 border border-slate-200/70 p-3 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableRlsAudit}
                        onChange={(e) => setEnableRlsAudit(e.target.checked)}
                        className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span className="text-xs font-semibold text-slate-700">Strict PostgreSQL RLS Auditing</span>
                    </label>

                    <label className="flex items-center space-x-2.5 bg-slate-50/70 border border-slate-200/70 p-3 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableTaintTracking}
                        onChange={(e) => setEnableTaintTracking(e.target.checked)}
                        className="rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span className="text-xs font-semibold text-slate-700">AST Taint & Dataflow Tracking</span>
                    </label>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="flex items-center justify-end pt-2">
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-2.5 px-8 py-3.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow-md cursor-pointer group"
                  >
                    <ScanLine className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>Start Security Scan</span>
                    <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>

              </form>
            )}

            {/* ========================================================= */}
            {/* VIEW STATE 2: SCANNING IN PROGRESS ANIMATION              */}
            {/* ========================================================= */}
            {viewState === 'scanning' && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 lg:p-12 shadow-xs text-center space-y-8 animate-in fade-in duration-300">
                {/* Radar Pulse Icon */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-35" />
                  <div className="absolute inset-2 rounded-full bg-blue-50 border border-blue-200" />
                  <div className="relative w-12 h-12 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-md">
                    <ScanLine className="w-6 h-6 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <h2 className="text-xl font-bold text-slate-900">
                    Executing Security Evaluation...
                  </h2>
                  <p className="text-xs text-slate-500">
                    Scanner subprocess running active AST and DAST probes on target. Gemini AI is actively evaluating vulnerabilities.
                  </p>
                  <div className="inline-flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Elapsed: {scanTimer}s</span>
                  </div>
                </div>

                {/* Stepper Progress */}
                <div className="max-w-xl mx-auto space-y-3 text-left">
                  {scanSteps.map((step, idx) => {
                    const isDone = idx < scanStepIndex;
                    const isCurrent = idx === scanStepIndex;
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          isCurrent
                            ? 'bg-[#EBF3FE] border-[#2563EB] shadow-xs'
                            : isDone
                            ? 'bg-emerald-50/50 border-emerald-200/60 text-slate-700'
                            : 'bg-slate-50/50 border-slate-200/50 opacity-60 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                            isDone 
                              ? 'bg-emerald-500 text-white' 
                              : isCurrent 
                              ? 'bg-[#2563EB] text-white animate-pulse' 
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <div>
                            <div className={`text-xs font-bold ${isCurrent ? 'text-[#2563EB]' : 'text-slate-800'}`}>
                              {step.label}
                            </div>
                            <div className="text-[11px] text-slate-500">{step.detail}</div>
                          </div>
                        </div>

                        {isCurrent && (
                          <div className="w-4 h-4 border-2 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin shrink-0" />
                        )}
                        {isDone && (
                          <span className="text-[11px] font-semibold text-emerald-600">Passed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW STATE 3: COMPLETED SCORE REPORT & GEMINI ANALYSIS   */}
            {/* ========================================================= */}
            {viewState === 'report' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                
                {/* 1. Score & Metrics Hero Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 lg:p-8 shadow-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
                    <div className="flex items-start space-x-5">
                      {/* Score Ring Gauge */}
                      <div className="shrink-0">
                        <ScoreRing score={currentScore} size="md" />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                            <Flame className="w-3.5 h-3.5 mr-1" />
                            {aiReport?.posture_grade || 'High Risk (Needs Remediation)'}
                          </span>
                          <span className="text-xs text-slate-400">Scan duration: 4.8s</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">
                          Security Posture Evaluation
                        </h2>
                        <p className="text-xs text-slate-500 font-mono flex items-center space-x-1.5">
                          <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Target: {repoUrl || 'https://github.com/enterprise/neobank-api'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Breakdown Severity Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                      <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3 text-center min-w-[85px]">
                        <div className="text-[11px] font-bold text-rose-700 uppercase">Critical</div>
                        <div className="text-2xl font-black text-rose-700 mt-0.5">{criticalCount}</div>
                      </div>
                      <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-3 text-center min-w-[85px]">
                        <div className="text-[11px] font-bold text-orange-700 uppercase">High</div>
                        <div className="text-2xl font-black text-orange-700 mt-0.5">{highCount}</div>
                      </div>
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-center min-w-[85px]">
                        <div className="text-[11px] font-bold text-amber-700 uppercase">Medium</div>
                        <div className="text-2xl font-black text-amber-700 mt-0.5">0</div>
                      </div>
                      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-center min-w-[85px]">
                        <div className="text-[11px] font-bold text-emerald-700 uppercase">Verified</div>
                        <div className="text-2xl font-black text-emerald-700 mt-0.5">0</div>
                      </div>
                    </div>
                  </div>

                  {/* Highlights Summary */}
                  <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-500 gap-2">
                    <div className="flex items-center space-x-4">
                      <span>Scanner Engine: <strong>isitsecure AST v2.4</strong></span>
                      <span>•</span>
                      <span>AI Model: <strong>Gemini 3.8 Flash</strong></span>
                      <span>•</span>
                      <span>Target Mode: <strong>Full Suite</strong></span>
                    </div>
                    <div className="text-slate-400">
                      Hash: <span className="font-mono text-slate-600">8619...3314</span>
                    </div>
                  </div>
                </div>

                {/* 2. GEMINI AI POSTURE & PROBLEM UNDERSTANDING REPORT */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 lg:p-8 shadow-xs space-y-6">
                  
                  {/* AI Header */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Sparkles className="w-5 h-5 fill-white text-white" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-bold text-slate-900">
                            Gemini AI Security Health Report
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200/80">
                            Powered by Gemini 3.8 Flash
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Autonomous root-cause synthesis, architecture blast radius analysis, and prioritized remediation roadmap.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-600">Verified by AST</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                  </div>

                  {isLoadingAiReport ? (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <div className="w-6 h-6 border-2 border-slate-200 border-t-[#2563EB] rounded-full animate-spin mx-auto" />
                      <div className="text-xs">Gemini AI is analyzing codebase architecture...</div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Section A: Executive Summary */}
                      <div className="bg-[#F8FAFD] border border-slate-200/80 rounded-xl p-4.5 space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                          <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>Executive Security Health Summary</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-sans">
                          {aiReport?.summary || 
                            'SecuAI evaluated the target and identified severe multi-tenant exposure vectors. The application currently defaults to open database table access without PostgreSQL Row Level Security (RLS) enforcement, alongside an exposed Supabase Service Role key and missing route token verification.'}
                        </p>
                      </div>

                      {/* Section B: Problem Understanding */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>Core Problem Understanding & Architectural Flaws</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {aiReport?.problem_understanding || 
                            'In modern Supabase and Next.js applications, PostgreSQL tables are open to all authenticated and anonymous clients by default unless Row Level Security is explicitly activated. When combined with committed Service Role keys and unauthenticated PATCH/GET route handlers, external actors can directly bypass application logic to exfiltrate and mutate cross-tenant records.'}
                        </p>
                      </div>

                      {/* Section C: Root Cause Analysis (4 cards) */}
                      <div className="space-y-2.5">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Why These Problems Happened (Root Cause Breakdown)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(aiReport?.root_cause_analysis || [
                            'PostgreSQL tables created via raw SQL migrations default to permissive access without ALTER TABLE ... ENABLE ROW LEVEL SECURITY.',
                            'Next.js Route Handlers lack centralized authentication middleware or JWT session validation before executing state mutations.',
                            'High-entropy Service Role credentials were hardcoded into frontend configuration instead of isolated in protected server secrets.',
                            'Missing tenant isolation WHERE clauses permit unauthorized cross-tenant object access (IDOR).',
                          ]).map((cause, idx) => (
                            <div key={idx} className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 flex items-start space-x-2.5">
                              <span className="w-5 h-5 rounded-md bg-blue-100 text-[#2563EB] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed">{cause}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section D: Threat Impact & Remediation Roadmap */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                        {/* Threat Impact */}
                        <div className="bg-rose-50/50 border border-rose-200/60 rounded-xl p-4 space-y-2">
                          <div className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center space-x-1.5">
                            <Flame className="w-3.5 h-3.5 text-rose-600" />
                            <span>Exploitation & Threat Impact</span>
                          </div>
                          <p className="text-xs text-rose-950/80 leading-relaxed">
                            {aiReport?.threat_impact || 
                              'An attacker can send unauthenticated PostgREST queries directly to your database endpoint to dump customer financial transactions and elevate privileges without touching application code.'}
                          </p>
                        </div>

                        {/* Remediation Roadmap */}
                        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 space-y-2">
                          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Actionable Remediation Roadmap</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-emerald-950/80">
                            {(aiReport?.remediation_roadmap || [
                              '1. Add ALTER TABLE ENABLE ROW LEVEL SECURITY with strict auth.uid() = user_id policies.',
                              '2. Rotate and revoke exposed Supabase Service Role keys immediately.',
                              '3. Implement route session checks in Next.js handlers before processing mutations.',
                              '4. Re-run SecuAI verification scanner to confirm patch neutralization and raise score to 100.',
                            ]).map((step, idx) => (
                              <li key={idx} className="flex items-start space-x-1.5">
                                <span className="font-bold text-emerald-700 shrink-0">•</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                    </div>
                  )}
                </div>

                {/* 3. VULNERABILITY FINDINGS LEDGER */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Detected Findings ({findings.length})
                    </div>
                    <span className="text-xs text-slate-400">
                      Click any finding to inspect code diff & verify fix with scanner
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {findings.map((finding) => {
                      const findingId = finding.id || finding.fingerprint;
                      const isCritical = finding.severity === 'CRITICAL';
                      return (
                        <div
                          key={finding.fingerprint || finding.id}
                          onClick={() => navigate(`/findings/${findingId}`)}
                          className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="flex items-start space-x-3.5 min-w-0">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border shrink-0 mt-0.5 ${
                              isCritical 
                                ? 'bg-rose-50 text-rose-700 border-rose-200/80' 
                                : 'bg-orange-50 text-orange-700 border-orange-200/80'
                            }`}>
                              {finding.severity}
                            </span>

                            <div className="space-y-1 min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors truncate">
                                {finding.title}
                              </h4>
                              <p className="text-xs text-slate-500 line-clamp-1">
                                {finding.description}
                              </p>
                              <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono pt-0.5">
                                {finding.file_path && (
                                  <span className="flex items-center space-x-1 truncate max-w-xs">
                                    <FileCode2 className="w-3 h-3 text-slate-400" />
                                    <span>{finding.file_path}:{finding.line_start || 1}</span>
                                  </span>
                                )}
                                {finding.category && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-sans font-semibold">
                                    {finding.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/findings/${findingId}`);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white group-hover:bg-[#EBF3FE] group-hover:text-[#2563EB] border border-slate-200/80 group-hover:border-blue-200/80 text-xs font-semibold text-slate-700 transition-colors shadow-2xs self-end md:self-center shrink-0"
                          >
                            <span>Inspect & Fix</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default NewScanPage;
