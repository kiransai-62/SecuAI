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
  X,
  TrendingUp
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import { ScoreTimelineChart } from '../components/ScoreTimelineChart';
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80 font-mono">
            <GithubIcon className="w-3.5 h-3.5 text-purple-600" /> GitHub Repository
          </span>
        );
      case 'ZIP':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 font-mono">
            <FileArchive className="w-3.5 h-3.5 text-amber-600" /> ZIP Archive
          </span>
        );
      case 'URL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 font-mono">
            <Globe className="w-3.5 h-3.5 text-blue-600" /> Live URL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 font-mono">
            {type}
          </span>
        );
    }
  };

  const renderScanStatusBadge = (st: string) => {
    const status = st.toUpperCase();
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>COMPLETED</span>
        </span>
      );
    }
    if (status === 'RUNNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 font-mono">
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span>RUNNING</span>
        </span>
      );
    }
    if (status === 'QUEUED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 font-mono">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>QUEUED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 font-mono">
        <AlertTriangle className="w-3 h-3 text-rose-600" />
        <span>FAILED</span>
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8FAFD] text-slate-800 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={project?.name || 'Project Details'} />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                id="btn-back-to-projects-list"
                onClick={() => navigate('/projects')}
                className="p-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-colors"
                aria-label="Back to projects list"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span
                  className="hover:text-slate-900 cursor-pointer transition-colors"
                  onClick={() => navigate('/projects')}
                >
                  Projects
                </span>
                <span>/</span>
                <span className="text-slate-900 font-semibold font-mono">
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
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-colors disabled:opacity-50"
                title="Refresh project details"
                aria-label="Refresh project details and scans"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isProjectFetching ? 'animate-spin text-blue-600' : ''}`}
                />
              </button>

              {project && (
                <button
                  id="btn-scan-again-header"
                  onClick={handleScanAgain}
                  disabled={createScanMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
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
              <div className="h-32 bg-slate-200/60 rounded-3xl" />
              <div className="h-64 bg-slate-200/40 rounded-3xl" />
            </div>
          ) : isProjectError ? (
            /* Error state with retry (handles 404 gracefully) */
            <div className="p-12 rounded-3xl bg-rose-50 border border-rose-200 text-center max-w-lg mx-auto space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-rose-900 tracking-tight">Project Not Found</h3>
                <p className="mt-1 text-xs text-rose-700/80 leading-relaxed">
                  {(projectError as any)?.status === 404
                    ? 'This project does not exist or you do not have permission to access it.'
                    : (projectError as Error)?.message || 'An error occurred while loading this project.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/projects')}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-colors"
                >
                  Back to Projects
                </button>
                <button
                  id="btn-retry-project-detail"
                  onClick={() => refetchProject()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ) : project ? (
            <div className="space-y-6">
              {/* Project Header Card */}
              <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {project.name}
                      </h1>
                      {getSourceBadge(project.source_type)}
                    </div>

                    {project.description && (
                      <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                        {project.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono">
                      {project.repository_url && (
                        <a
                          href={project.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          <GithubIcon className="w-3.5 h-3.5" />
                          <span>{project.repository_url.replace('https://github.com/', '')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {project.framework && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{project.framework}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-400">
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
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 text-xs font-semibold shadow-2xs transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>

                    <button
                      id="btn-delete-project"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs font-semibold shadow-2xs transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION: ScoreRing & Severity Counts (Non-color-only) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ScoreRing Card */}
                <div className="lg:col-span-5 p-6 md:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Project Health Score
                    </span>
                    {latestScan && renderScanStatusBadge(latestScan.status)}
                  </div>

                  <div className="flex items-center gap-6">
                    <ScoreRing score={latestScore} size="lg" />

                    <div className="space-y-1.5">
                      <div className="text-xs font-mono text-blue-600 uppercase tracking-widest font-semibold">
                        Latest Scan Grade
                      </div>
                      <div className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {getScoreLabel(latestScore)}
                      </div>
                      <p className="text-xs text-slate-500">
                        {latestScan
                          ? `Evaluated on ${new Date(latestScan.created_at).toLocaleDateString()}`
                          : 'No scan performed yet.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      id="btn-scan-again-main"
                      onClick={handleScanAgain}
                      disabled={createScanMutation.isPending}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
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
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-600 hover:text-blue-700 font-semibold rounded"
                      >
                        <span>View Latest Scan</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Severity Counts Grid */}
                <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-3xl bg-rose-50/70 border border-rose-200/80 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-rose-100 text-rose-700 border border-rose-200/80">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
                        <span>CRITICAL</span>
                      </span>
                      <span className="text-xs text-rose-600 font-mono font-semibold">-25 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-rose-900 font-mono">
                        {counts.critical}
                      </div>
                      <p className="text-xs text-rose-700/80 mt-1">
                        Critical vulnerabilities
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-amber-100 text-amber-800 border border-amber-200/80">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        <span>HIGH</span>
                      </span>
                      <span className="text-xs text-amber-700 font-mono font-semibold">-15 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-amber-900 font-mono">
                        {counts.high}
                      </div>
                      <p className="text-xs text-amber-700/80 mt-1">
                        High risk issues
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-amber-50/40 border border-amber-200/60 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-amber-100/60 text-amber-800 border border-amber-200/60">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        <span>MEDIUM</span>
                      </span>
                      <span className="text-xs text-amber-700 font-mono font-semibold">-7 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-slate-800 font-mono">
                        {counts.medium}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Medium risk findings
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-3xl bg-blue-50/50 border border-blue-200/60 flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider bg-blue-100 text-blue-700 border border-blue-200/60">
                        <Info className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                        <span>LOW</span>
                      </span>
                      <span className="text-xs text-blue-600 font-mono font-semibold">-2 pts</span>
                    </div>
                    <div className="mt-4">
                      <div className="text-4xl font-extrabold text-slate-800 font-mono">
                        {counts.low}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Low risk warnings
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Score Timeline Chart */}
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
                      Based on {scans.length} scan{scans.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <ScoreTimelineChart scans={scans} />
                </div>
              )}

              {/* SECTION: Scan History Table (date, score, counts, status) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Scan History
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {scans.length} execution{scans.length === 1 ? '' : 's'} recorded
                  </span>
                </div>

                <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-xs">
                  {isScansLoading ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Loading scan history...
                    </div>
                  ) : scans.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                      <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-500">
                        No scan history yet for this project.
                      </p>
                      <button
                        onClick={handleScanAgain}
                        className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors"
                      >
                        Run First Scan
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse" role="table">
                        <thead>
                          <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Security Score</th>
                            <th className="py-3 px-4">Severity Counts</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
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
                                className="hover:bg-slate-50/80 transition-colors group"
                              >
                                <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-600">
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
                                    <span className="font-mono font-bold text-slate-900 text-sm">
                                      {sc}/100
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                        sc >= 90
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                          : sc >= 75
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                          : sc >= 50
                                          ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                                      }`}
                                    >
                                      {grade}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                    <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/80 font-bold">
                                      {crit} CRIT
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80 font-bold">
                                      {hgh} HIGH
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50/60 text-amber-800 border border-amber-200/60 font-bold">
                                      {med} MED
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-bold">
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-blue-600 hover:text-blue-700 border border-slate-200/80 text-xs font-semibold transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xl relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Scan Again with ZIP Archive
              </h3>
              <button
                onClick={() => setIsUploadZipModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleZipUploadSubmit} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/60 hover:bg-blue-50/30"
              >
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">
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
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedZipFile || createScanMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-lg bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xl relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Edit Project</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Project Name <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      editName.length > 80 ? 'text-rose-600 font-bold' : 'text-slate-400'
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
                  className={`w-full px-4 py-2.5 rounded-xl bg-white border text-xs text-slate-900 focus:outline-none transition-colors shadow-2xs ${
                    editErrors.name
                      ? 'border-rose-400 focus:border-rose-500'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                  }`}
                />
                {editErrors.name && (
                  <p className="text-[11px] text-rose-600">{editErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      editDescription.length > 300 ? 'text-rose-600 font-bold' : 'text-slate-400'
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
                  className={`w-full px-4 py-2.5 rounded-xl bg-white border text-xs text-slate-900 focus:outline-none transition-colors resize-none shadow-2xs ${
                    editErrors.description
                      ? 'border-rose-400 focus:border-rose-500'
                      : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                  }`}
                />
                {editErrors.description && (
                  <p className="text-[11px] text-rose-600">{editErrors.description}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-edit-project"
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm disabled:opacity-50"
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
