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
        return <GithubIcon className="w-3.5 h-3.5 text-purple-600" />;
      case 'ZIP':
        return <FileArchive className="w-3.5 h-3.5 text-amber-600" />;
      case 'URL':
        return <Globe className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <FolderGit2 className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  const getSourceBadge = (type: string) => {
    switch (type) {
      case 'GITHUB':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 font-mono">
            <GithubIcon className="w-3 h-3" /> GitHub
          </span>
        );
      case 'ZIP':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 font-mono">
            <FileArchive className="w-3 h-3" /> Archive ZIP
          </span>
        );
      case 'URL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
            <Globe className="w-3 h-3" /> Web Endpoint
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60 font-mono">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFD] text-slate-800 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title="Projects" />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Top Bar / Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
                <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  {projects.length} Total
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Manage your codebases, security scan scopes, and autonomous feedback loops.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="btn-refresh-projects"
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-colors disabled:opacity-50"
                title="Refresh project list"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
              </button>
              <button
                id="btn-new-project-header"
                onClick={() => navigate('/projects/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="input-search-projects"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects by name, description, or URL..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Content States: Loading / Error / Empty / Table */}
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-10 bg-slate-200/60 rounded-xl" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-white rounded-xl border border-slate-200/80 flex items-center px-4 space-x-4 shadow-2xs">
                  <div className="w-8 h-8 rounded-lg bg-slate-200/70" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/4 bg-slate-200/70 rounded" />
                    <div className="h-2 w-1/2 bg-slate-200/50 rounded" />
                  </div>
                  <div className="w-20 h-6 bg-slate-200/60 rounded-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-rose-900">Failed to Load Projects</h3>
                <p className="mt-1 text-xs text-rose-700/80">
                  {(error as Error)?.message || 'An error occurred while communicating with the database.'}
                </p>
              </div>
              <button
                id="btn-retry-projects"
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold shadow-2xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : projects.length === 0 ? (
            /* Empty State: exactly one CTA as requested */
            <div className="p-12 md:p-16 rounded-3xl bg-white border border-slate-200/80 text-center max-w-md mx-auto space-y-6 shadow-xs">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                <FolderGit2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">No Projects Yet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Connect your first codebase to start autonomous security scans, explain vulnerabilities, and apply verified fixes.
                </p>
              </div>
              <div>
                <button
                  id="btn-empty-state-cta"
                  onClick={() => navigate('/projects/new')}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Project</span>
                </button>
              </div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs">No projects match your search query "{searchTerm}".</p>
            </div>
          ) : (
            /* Projects Table */
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-mono uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4 font-semibold">Project Name</th>
                      <th className="py-3.5 px-4 font-semibold">Source</th>
                      <th className="py-3.5 px-4 font-semibold">Repository / Location</th>
                      <th className="py-3.5 px-4 font-semibold">Created</th>
                      <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProjects.map((project) => (
                      <tr
                        key={project.id}
                        id={`project-row-${project.id}`}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              {getSourceIcon(project.source_type)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {project.name}
                              </div>
                              {project.description && (
                                <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                  {project.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          {getSourceBadge(project.source_type)}
                        </td>

                        <td className="py-4 px-4 text-slate-600 font-mono text-[11px]">
                          {project.repository_url || project.repo_url ? (
                            <a
                              href={project.repository_url || project.repo_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              <span className="truncate max-w-[220px]">
                                {(project.repository_url || project.repo_url || '').replace('https://github.com/', '')}
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Local / Direct Upload</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(project.created_at).toLocaleDateString()}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              id={`btn-view-${project.id}`}
                              onClick={() => navigate(`/projects/${project.id}`)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="View Project"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-delete-${project.id}`}
                              onClick={() => setProjectToDelete(project)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
