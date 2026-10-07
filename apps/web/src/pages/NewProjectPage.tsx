import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileArchive, 
  Globe, 
  ArrowLeft, 
  Check, 
  AlertCircle, 
  Loader2, 
  Upload, 
  Sparkles,
  Info
} from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import { api } from '../services/api';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useToast } from '../components/Toast';

type SourceType = 'ZIP' | 'GITHUB' | 'URL';

const GITHUB_REGEX = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/)?$/;

export const NewProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sourceType, setSourceType] = useState<SourceType>('GITHUB');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [framework, setFramework] = useState('Next.js / Node.js');
  const [zipFileName, setZipFileName] = useState<string | null>(null);

  // Field validation state
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    repositoryUrl?: string;
    general?: string;
  }>({});

  const validate = (): boolean => {
    const newErrors: { name?: string; description?: string; repositoryUrl?: string } = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Project name is required';
    } else if (trimmedName.length > 80) {
      newErrors.name = 'Project name cannot exceed 80 characters';
    }

    if (description && description.trim().length > 300) {
      newErrors.description = 'Description cannot exceed 300 characters';
    }

    if (sourceType === 'GITHUB') {
      const trimmedUrl = repositoryUrl.trim();
      if (!trimmedUrl) {
        newErrors.repositoryUrl = 'GitHub repository URL is required';
      } else if (!GITHUB_REGEX.test(trimmedUrl)) {
        newErrors.repositoryUrl = 'Repository URL must follow the exact format https://github.com/<owner>/<repo>';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      return api.createProject({
        name: name.trim(),
        description: description.trim() || null,
        source_type: sourceType,
        repository_url: sourceType === 'GITHUB' ? repositoryUrl.trim() : null,
        framework: framework.trim() || null,
      });
    },
    onSuccess: async (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (newProject.source_type === 'GITHUB' && newProject.repository_url) {
        try {
          const newScan = await api.createProjectScan(newProject.id, {
            repository_url: newProject.repository_url,
          });
          toast.success('Project created and GitHub repository scan queued!');
          if (newScan?.id) {
            navigate(`/scans/${newScan.id}`);
            return;
          }
        } catch (scanErr: any) {
          console.warn('[NewProjectPage] Initial scan trigger warning:', scanErr);
        }
      }
      toast.success('Project created successfully!');
      navigate(`/projects/${newProject.id}`);
    },
    onError: (err: any) => {
      setErrors((prev) => ({
        ...prev,
        general: err.message || 'Failed to create project. Please verify inputs and retry.',
      }));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate();
  };

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFileName(file.name);
      if (!name) {
        // Auto-fill project name from zip filename without extension
        const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 80);
        setName(cleanName);
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#030712] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Breadcrumb / Back button */}
          <div className="flex items-center gap-3">
            <button
              id="btn-back-to-projects"
              onClick={() => navigate('/projects')}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="hover:text-white cursor-pointer" onClick={() => navigate('/projects')}>
                Projects
              </span>
              <span>/</span>
              <span className="text-cyan-400 font-medium">New Project</span>
            </div>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Create New Project</span>
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Configure your application repository or zip archive for continuous security scanning and autonomous patch generation.
              </p>
            </div>

            {/* Error Banner with Retry */}
            {errors.general && (
              <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 text-rose-300 flex items-start justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-rose-200">Creation Error</h4>
                    <p className="text-xs text-rose-300/80 mt-0.5">{errors.general}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium border border-rose-500/40 shrink-0 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Source Picker (ZIP | GitHub | URL marked Coming Soon) */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  1. Select Source Provider
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* GitHub Option */}
                  <div
                    id="source-picker-github"
                    onClick={() => {
                      setSourceType('GITHUB');
                      setErrors((prev) => ({ ...prev, repositoryUrl: undefined }));
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden ${
                      sourceType === 'GITHUB'
                        ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/50'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <GithubIcon className="w-5 h-5" />
                      </div>
                      {sourceType === 'GITHUB' && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 text-black flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3.5">
                      <h4 className="text-xs font-bold text-white">GitHub Repository</h4>
                      <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                        Scan public or private GitHub repository URL.
                      </p>
                    </div>
                  </div>

                  {/* ZIP Option */}
                  <div
                    id="source-picker-zip"
                    onClick={() => {
                      setSourceType('ZIP');
                      setErrors((prev) => ({ ...prev, repositoryUrl: undefined }));
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden ${
                      sourceType === 'ZIP'
                        ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/50'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <FileArchive className="w-5 h-5" />
                      </div>
                      {sourceType === 'ZIP' && (
                        <div className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3.5">
                      <h4 className="text-xs font-bold text-white">ZIP Archive</h4>
                      <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                        Upload direct source bundle (.zip) for isolated sandbox scan.
                      </p>
                    </div>
                  </div>

                  {/* URL Option - Strictly marked "Coming Soon" */}
                  <div
                    id="source-picker-url-disabled"
                    className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] opacity-60 cursor-not-allowed relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400/60 border border-blue-500/10">
                        <Globe className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Coming Soon
                      </span>
                    </div>
                    <div className="mt-3.5">
                      <h4 className="text-xs font-bold text-slate-400">Live URL Endpoint</h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                        DAST dynamic penetration scanning against live APIs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Source-specific configuration */}
              {sourceType === 'GITHUB' && (
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">
                      GitHub Repository URL <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      https://github.com/&lt;owner&gt;/&lt;repo&gt;
                    </span>
                  </div>
                  <input
                    id="input-repository-url"
                    type="url"
                    value={repositoryUrl}
                    onChange={(e) => {
                      setRepositoryUrl(e.target.value);
                      if (errors.repositoryUrl) setErrors((prev) => ({ ...prev, repositoryUrl: undefined }));
                    }}
                    placeholder="https://github.com/organization/repository-name"
                    className={`w-full px-4 py-2.5 rounded-xl bg-black/40 border text-xs text-white placeholder-slate-600 font-mono focus:outline-none transition-colors ${
                      errors.repositoryUrl
                        ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50'
                    }`}
                  />
                  {errors.repositoryUrl ? (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.repositoryUrl}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Only standard GitHub repository format is supported (HTTPS).</span>
                    </p>
                  )}
                </div>
              )}

              {sourceType === 'ZIP' && (
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Upload Archive (.zip) <span className="text-rose-400">*</span>
                  </label>
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 hover:border-amber-500/40 rounded-2xl bg-black/30 cursor-pointer transition-colors group">
                    <Upload className="w-8 h-8 text-amber-400/80 group-hover:scale-110 transition-transform mb-2" />
                    <span className="text-xs font-semibold text-slate-200">
                      {zipFileName ? zipFileName : 'Click to select or drag and drop ZIP archive'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Max archive size: 50MB (Node.js, Next.js, Python, or Go codebases)
                    </span>
                    <input
                      id="input-zip-file"
                      type="file"
                      accept=".zip"
                      onChange={handleZipFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Step 2: Project Metadata (Name & Description with limits) */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-5">
                {/* Project Name (1-80 chars) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">
                      Project Name <span className="text-rose-400">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        name.length > 80 ? 'text-rose-400 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {name.length} / 80
                    </span>
                  </div>
                  <input
                    id="input-project-name"
                    type="text"
                    maxLength={85}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g., E-Commerce Core API"
                    className={`w-full px-4 py-2.5 rounded-xl bg-black/40 border text-xs text-white placeholder-slate-600 focus:outline-none transition-colors ${
                      errors.name
                        ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50'
                    }`}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                {/* Description (<= 300 chars) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">
                      Description <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        description.length > 300 ? 'text-rose-400 font-bold' : 'text-slate-500'
                      }`}
                    >
                      {description.length} / 300
                    </span>
                  </div>
                  <textarea
                    id="input-project-description"
                    rows={3}
                    maxLength={310}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
                    }}
                    placeholder="Brief description of the application architecture, compliance requirements, or sensitive data domains..."
                    className={`w-full px-4 py-2.5 rounded-xl bg-black/40 border text-xs text-white placeholder-slate-600 focus:outline-none transition-colors resize-none ${
                      errors.description
                        ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50'
                    }`}
                  />
                  {errors.description && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.description}</span>
                    </p>
                  )}
                </div>

                {/* Framework Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Framework / Environment
                  </label>
                  <input
                    id="input-project-framework"
                    type="text"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    placeholder="e.g., Next.js 15, FastAPI, Django, Express"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  id="btn-cancel-create"
                  onClick={() => navigate('/projects')}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-project"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs transition-all shadow-[0_0_25px_rgba(6,182,212,0.25)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] disabled:opacity-50 active:scale-95"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Project...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Create Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};
