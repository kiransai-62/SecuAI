import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  FileArchive, 
  Globe, 
  Clock, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  RefreshCw, 
  Loader2, 
  Play, 
  FolderGit2, 
  FileCode2,
  Check,
  CheckCircle2,
  ArrowRight,
  Upload,
  X
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import { api } from '../services/api';
import { Project, Scan } from '../types';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ScoreRing, getScoreLabel } from '../components/ScoreRing';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadZipModalOpen, setIsUploadZipModalOpen] = useState(false);
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editErrors, setEditErrors] = useState<{ name?: string; description?: string }>({});

  // 1. Query project by ID
  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
    error: projectError,
    refetch: refetchProject,
    isFetching: isProjectFetching,
  } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id!),
    enabled: Boolean(id),
    retry: 1,
  });

  // 2. Query project scans history
  const {
    data: scans = [],
    isLoading: isScansLoading,
    refetch: refetchScans,
  } = useQuery<Scan[]>({
    queryKey: ['projectScans', id],
    queryFn: () => api.getProjectScans(id!),
    enabled: Boolean(id),
  });

  // Edit mutation
  const updateMutation = useMutation({
    mutationFn: (updates: { name: string; description: string | null }) =>
      api.updateProject(id!, updates),
    onSuccess: (updated) => {
      queryClient.setQueryData(['project', id], updated);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated successfully');
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update project');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteProject(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
      navigate('/projects');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete project');
    },
  });

  // Start / "Scan again" mutation
  const createScanMutation = useMutation({
    mutationFn: (payload?: { file?: File; repository_url?: string }) =>
      api.createProjectScan(id!, payload),
    onSuccess: (newScan) => {
      queryClient.invalidateQueries({ queryKey: ['projectScans', id] });
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      toast.success(`Security scan queued successfully!`);
      setIsUploadZipModalOpen(false);
      setSelectedZipFile(null);
      if (newScan?.id) {
        navigate(`/scans/${newScan.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to queue scan');
    },
  });

  const latestScan = scans.length > 0 ? scans[0] : null;
  const latestScore = latestScan?.security_score ?? 100;
  const counts = {
    critical: latestScan?.critical_count ?? 0,
    high: latestScan?.high_count ?? 0,
    medium: latestScan?.medium_count ?? 0,
    low: latestScan?.low_count ?? 0,
    total: latestScan?.findings_count ?? 0,
  };

  const handleScanAgain = () => {
    if (project?.source_type === 'ZIP') {
      setIsUploadZipModalOpen(true);
    } else {
      createScanMutation.mutate({
        repository_url: project?.repository_url || undefined,
      });
    }
  };

  const handleZipUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZipFile) {
      toast.error('Please choose a .zip file to scan');
      return;
    }
    createScanMutation.mutate({ file: selectedZipFile });
  };

  const openEditModal = () => {
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description || '');
      setEditErrors({});
      setIsEditModalOpen(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; description?: string } = {};
    const trimmed = editName.trim();
    if (!trimmed) {
      newErrors.name = 'Project name is required (1-80 characters)';
    } else if (trimmed.length > 80) {
      newErrors.name = 'Project name cannot exceed 80 characters';
    }

    if (editDescription && editDescription.trim().length > 300) {
      newErrors.description = 'Description cannot exceed 300 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      return;
    }

    updateMutation.mutate({
      name: trimmed,
      description: editDescription.trim() || null,
    });
  };

  const getSourceBadge = (type: string) => {
    switch (type) {
      case 'GITHUB':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
            <GithubIcon className="w-3.5 h-3.5" /> GitHub Repository
          </span>
        );
      case 'ZIP':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
            <FileArchive className="w-3.5 h-3.5" /> ZIP Archive
          </span>
        );
      case 'URL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
            <Globe className="w-3.5 h-3.5" /> Live URL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20 font-mono">
            {type}
          </span>
        );
    }
  };

  const renderScanStatusBadge = (st: string) => {
    const status = st.toUpperCase();
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
          <CheckCircle2 className="w-3 h-3" />
          <span>COMPLETED</span>
        </span>
      );
    }
    if (status === 'RUNNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>RUNNING</span>
        </span>
      );
    }
    if (status === 'QUEUED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
          <Clock className="w-3 h-3" />
          <span>QUEUED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
        <AlertTriangle className="w-3 h-3" />
        <span>FAILED</span>
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#030712] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                id="btn-back-to-projects-list"
                onClick={() => navigate('/projects')}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                aria-label="Back to projects list"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span
                  className="hover:text-white cursor-pointer transition-colors"
                  onClick={() => navigate('/projects')}
                >
                  Projects
                </span>
                <span>/</span>
                <span className="text-cyan-400 font-medium font-mono">
                  {project?.name || id}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  refetchProject();
                  refetchScans();
                }}
                disabled={isProjectFetching}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                title="Refresh project details"
                aria-label="Refresh project details and scans"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isProjectFetching ? 'animate-spin text-cyan-400' : ''}`}
                />
              </button>

              {project && (
                <button
                  id="btn-scan-again-header"
                  onClick={handleScanAgain}
                  disabled={createScanMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {createScanMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>Scan again</span>
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isProjectLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-32 bg-white/5 rounded-3xl border border-white/5" />
              <div className="h-64 bg-white/[0.02] rounded-3xl border border-white/5" />
            </div>
          ) : isProjectError ? (
            /* Error state with retry (handles 404 gracefully) */
            <div className="p-12 rounded-3xl bg-rose-950/20 border border-rose-500/20 text-center max-w-lg mx-auto space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(244,63,94,0.15)]">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Project Not Found</h3>
                <p className="mt-1 text-xs text-rose-300/80 leading-relaxed">
                  {(projectError as any)?.status === 404
                    ? 'This project does not exist or you do not have permission to access it.'
                    : (projectError as Error)?.message || 'An error occurred while loading this project.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/projects')}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Back to Projects
                </button>
                <button
                  id="btn-retry-project-detail"
                  onClick={() => refetchProject()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ) : project ? (
            <div className="space-y-6">
              {/* Project Header Card */}
              <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        {project.name}
                      </h1>
                      {getSourceBadge(project.source_type)}
                    </div>

                    {project.description && (
                      <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        {project.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                      {project.repository_url && (
                        <a
                          href={project.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          <GithubIcon className="w-3.5 h-3.5" />
                          <span>{project.repository_url.replace('https://github.com/', '')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {project.framework && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{project.framework}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      id="btn-edit-project"
                      onClick={openEditModal}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Edit</span>
                    </button>

                    <button
                      id="btn-delete-project"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 hover:border-rose-500/40 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION: ScoreRing & Severity Counts (Non-color-only) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ScoreRing Card */}
                <div className="lg:col-span-5 p-6 md:p-8 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Project Health Score
                    </span>
                    {latestScan && renderScanStatusBadge(latestScan.status)}
                  </div>

                  <div className="flex items-center gap-6">
                    <ScoreRing score={latestScore} size="lg" />

                    <div className="space-y-1.5">
                      <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-semibold">
                        Latest Scan Grade
                      </div>
                      <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                        {getScoreLabel(latestScore)}
                      </div>
                      <p className="text-xs text-slate-400">
                        {latestScan
                          ? `Evaluated on ${new Date(latestScan.created_at).toLocaleDateString()}`
                          : 'No scan performed yet.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <button
                      id="btn-scan-again-main"
                      onClick={handleScanAgain}
                      disabled={createScanMutation.isPending}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-lg shadow-cyan-950/50 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      {createScanMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>Scan again</span>
                    </button>

                    {latestScan && (
                      <Link
                        to={`/scans/${latestScan.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                      >
                        <span>View Latest Scan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Severity Counts Grid */}
                <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                        <span>CRITICAL</span>
                      </span>
                      <span className="text-xs text-rose-300/80 font-mono">-25 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-white font-mono">
                        {counts.critical}
                      </div>
                      <p className="text-xs text-rose-200/70 mt-1">
                        Critical vulnerabilities
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
                        <span>HIGH</span>
                      </span>
                      <span className="text-xs text-orange-300/80 font-mono">-15 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-white font-mono">
                        {counts.high}
                      </div>
                      <p className="text-xs text-orange-200/70 mt-1">
                        High risk issues
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                        <span>MEDIUM</span>
                      </span>
                      <span className="text-xs text-amber-300/80 font-mono">-7 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-white font-mono">
                        {counts.medium}
                      </div>
                      <p className="text-xs text-amber-200/70 mt-1">
                        Medium risk findings
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        <Info className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                        <span>LOW</span>
                      </span>
                      <span className="text-xs text-blue-300/80 font-mono">-2 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-white font-mono">
                        {counts.low}
                      </div>
                      <p className="text-xs text-blue-200/70 mt-1">
                        Low risk warnings
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Scan History Table (date, score, counts, status) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Scan History
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {scans.length} execution{scans.length === 1 ? '' : 's'} recorded
                  </span>
                </div>

                <div className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden shadow-xl">
                  {isScansLoading ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Loading scan history...
                    </div>
                  ) : scans.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                      <Clock className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-xs text-slate-400">
                        No scan history yet for this project.
                      </p>
                      <button
                        onClick={handleScanAgain}
                        className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      >
                        Run First Scan
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse" role="table">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.01] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Security Score</th>
                            <th className="py-3 px-4">Severity Counts</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {scans.map((s) => {
                            const sc = s.security_score ?? 100;
                            const grade = getScoreLabel(sc);
                            const crit = s.critical_count ?? 0;
                            const hgh = s.high_count ?? 0;
                            const med = s.medium_count ?? 0;
                            const low = s.low_count ?? 0;

                            return (
                              <tr
                                key={s.id}
                                className="hover:bg-white/[0.03] transition-colors group"
                              >
                                <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-300">
                                  {new Date(s.created_at).toLocaleString([], {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-white text-sm">
                                      {sc}/100
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                        sc >= 90
                                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                          : sc >= 75
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : sc >= 50
                                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                      }`}
                                    >
                                      {grade}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">
                                      {crit} CRIT
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 font-bold">
                                      {hgh} HIGH
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                                      {med} MED
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-bold">
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-cyan-200 border border-white/5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
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
            </div>
          ) : null}
        </main>
      </div>

      {/* Upload ZIP Modal for "Scan again" on ZIP Projects */}
      {isUploadZipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#0c121e] border border-white/10 rounded-2xl p-6 shadow-2xl relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-bold text-white tracking-tight">
                Scan Again with ZIP Archive
              </h3>
              <button
                onClick={() => setIsUploadZipModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleZipUploadSubmit} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 hover:border-cyan-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-white/[0.01] hover:bg-cyan-500/[0.02]"
              >
                <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-200">
                  {selectedZipFile ? selectedZipFile.name : 'Select or drop a ZIP archive'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Max size: 25MB (.zip only)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedZipFile(f);
                  }}
                  className="hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadZipModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedZipFile || createScanMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  {createScanMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading & Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Scan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg bg-[#0c121e] border border-white/10 rounded-2xl p-6 shadow-2xl relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-bold text-white tracking-tight">Edit Project</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    Project Name <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      editName.length > 80 ? 'text-rose-400 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {editName.length} / 80
                  </span>
                </div>
                <input
                  id="input-edit-project-name"
                  type="text"
                  maxLength={85}
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editErrors.name) setEditErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  className={`w-full px-4 py-2.5 rounded-xl bg-black/50 border text-xs text-white focus:outline-none transition-colors ${
                    editErrors.name
                      ? 'border-rose-500/60 focus:border-rose-500'
                      : 'border-white/10 focus:border-cyan-500/50'
                  }`}
                />
                {editErrors.name && (
                  <p className="text-[11px] text-rose-400">{editErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    Description <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      editDescription.length > 300 ? 'text-rose-400 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {editDescription.length} / 300
                  </span>
                </div>
                <textarea
                  id="input-edit-project-description"
                  rows={3}
                  maxLength={310}
                  value={editDescription}
                  onChange={(e) => {
                    setEditDescription(e.target.value);
                    if (editErrors.description)
                      setEditErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  className={`w-full px-4 py-2.5 rounded-xl bg-black/50 border text-xs text-white focus:outline-none transition-colors resize-none ${
                    editErrors.description
                      ? 'border-rose-500/60 focus:border-rose-500'
                      : 'border-white/10 focus:border-cyan-500/50'
                  }`}
                />
                {editErrors.description && (
                  <p className="text-[11px] text-rose-400">{editErrors.description}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-edit-project"
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-all shadow-lg shadow-cyan-950/50 disabled:opacity-50"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Project?"
        message={`Are you sure you want to permanently delete "${project?.name}"? All scans, vulnerabilities, and verification audit trails associated with this project will be deleted.`}
        confirmLabel="Delete Project"
        cancelLabel="Cancel"
        isLoading={deleteMutation.isPending}
        isDanger={true}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
};
