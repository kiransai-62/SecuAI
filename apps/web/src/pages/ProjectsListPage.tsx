import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FolderGit2, 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink, 
  AlertCircle, 
  RefreshCw, 
  FileArchive, 
  Globe, 
  Clock, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import { api } from '../services/api';
import { Project } from '../types';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';

export const ProjectsListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Fetch Projects with TanStack Query (handles loading & error states)
  const {
    data: projects = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
  });

  // Delete Project Mutation
  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
      setProjectToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete project');
    },
  });

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.repository_url && p.repository_url.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'GITHUB':
        return <GithubIcon className="w-3.5 h-3.5 text-purple-400" />;
      case 'ZIP':
        return <FileArchive className="w-3.5 h-3.5 text-amber-400" />;
      case 'URL':
        return <Globe className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const getSourceBadge = (type: string) => {
    switch (type) {
      case 'GITHUB':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
            <GithubIcon className="w-3 h-3" /> GitHub
          </span>
        );
      case 'ZIP':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
            <FileArchive className="w-3 h-3" /> Archive ZIP
          </span>
        );
      case 'URL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">
            <Globe className="w-3 h-3" /> Web Endpoint
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20 font-mono">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#030712] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Top Bar / Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">Projects</h1>
                <span className="px-2.5 py-0.5 text-xs font-mono font-medium rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {projects.length} Total
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Manage your codebases, security scan scopes, and autonomous feedback loops.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="btn-refresh-projects"
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50"
                title="Refresh project list"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
              <button
                id="btn-new-project-header"
                onClick={() => navigate('/projects/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="input-search-projects"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects by name, description, or URL..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Content States: Loading / Error / Empty / Table */}
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-10 bg-white/5 rounded-xl border border-white/5" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-white/[0.02] rounded-xl border border-white/5 flex items-center px-4 space-x-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/4 bg-white/5 rounded" />
                    <div className="h-2 w-1/2 bg-white/5 rounded" />
                  </div>
                  <div className="w-20 h-6 bg-white/5 rounded-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-500/20 text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-rose-200">Failed to Load Projects</h3>
                <p className="mt-1 text-xs text-rose-300/70">
                  {(error as Error)?.message || 'An error occurred while communicating with the database.'}
                </p>
              </div>
              <button
                id="btn-retry-projects"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : projects.length === 0 ? (
            /* Empty State: exactly one CTA as requested */
            <div className="p-12 md:p-16 rounded-3xl bg-white/[0.02] border border-white/5 text-center max-w-md mx-auto space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                <FolderGit2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white tracking-tight">No Projects Yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect your first codebase to start autonomous security scans, explain vulnerabilities, and apply verified fixes.
                </p>
              </div>
              <div>
                <button
                  id="btn-empty-state-cta"
                  onClick={() => navigate('/projects/new')}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:shadow-[0_0_35px_rgba(6,182,212,0.45)] active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Project</span>
                </button>
              </div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white/[0.01] rounded-2xl border border-white/5">
              <p className="text-xs">No projects match your search query "{searchTerm}".</p>
            </div>
          ) : (
            /* Projects Table */
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4 font-medium">Project Name</th>
                      <th className="py-3.5 px-4 font-medium">Source</th>
                      <th className="py-3.5 px-4 font-medium">Repository / Location</th>
                      <th className="py-3.5 px-4 font-medium">Created</th>
                      <th className="py-3.5 px-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.map((project) => (
                      <tr
                        key={project.id}
                        id={`project-row-${project.id}`}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              {getSourceIcon(project.source_type)}
                            </div>
                            <div>
                              <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                                {project.name}
                              </div>
                              {project.description && (
                                <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                  {project.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          {getSourceBadge(project.source_type)}
                        </td>

                        <td className="py-4 px-4 text-slate-300 font-mono text-[11px]">
                          {project.repository_url || project.repo_url ? (
                            <a
                              href={project.repository_url || project.repo_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-cyan-400/80 hover:text-cyan-300 hover:underline"
                            >
                              <span className="truncate max-w-[220px]">
                                {(project.repository_url || project.repo_url || '').replace('https://github.com/', '')}
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-500 italic">Local / Direct Upload</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(project.created_at).toLocaleDateString()}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              id={`btn-view-${project.id}`}
                              onClick={() => navigate(`/projects/${project.id}`)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all"
                              title="View Project"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-delete-${project.id}`}
                              onClick={() => setProjectToDelete(project)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(projectToDelete)}
        title="Delete Project?"
        message={`Are you sure you want to permanently delete "${projectToDelete?.name}"? All associated security scans, findings, and verification histories will be deleted.`}
        confirmLabel="Delete Project"
        cancelLabel="Cancel"
        isLoading={deleteMutation.isPending}
        isDanger={true}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={() => {
          if (projectToDelete) {
            deleteMutation.mutate(projectToDelete.id);
          }
        }}
      />
    </div>
  );
};
