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
  const [targetUrl, setTargetUrl] = useState('');
  const [confirmedOwnership, setConfirmedOwnership] = useState(false);
  const [framework, setFramework] = useState('Next.js / Node.js');
  const [zipFileName, setZipFileName] = useState<string | null>(null);

  // Field validation state
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    repositoryUrl?: string;
    targetUrl?: string;
    confirmedOwnership?: string;
    general?: string;
  }>({});

  const validate = (): boolean => {
    const newErrors: {
      name?: string;
      description?: string;
      repositoryUrl?: string;
      targetUrl?: string;
      confirmedOwnership?: string;
    } = {};

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
    } else if (sourceType === 'URL') {
      const trimmedTarget = targetUrl.trim();
      if (!trimmedTarget) {
        newErrors.targetUrl = 'Target URL is required for live endpoint scan';
      } else if (!trimmedTarget.startsWith('http://') && !trimmedTarget.startsWith('https://')) {
        newErrors.targetUrl = 'Target URL must start with http:// or https://';
      }
      if (!confirmedOwnership) {
        newErrors.confirmedOwnership = 'You must confirm ownership/authorization to scan this target';
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
        target_url: sourceType === 'URL' ? targetUrl.trim() : null,
        confirmed_ownership: sourceType === 'URL' ? confirmedOwnership : undefined,
        framework: framework.trim() || undefined,
      });
    },
    onSuccess: async (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      
      // If URL target, optionally start initial scan automatically
      if (sourceType === 'URL' && newProject.target_url) {
        try {
          await api.startScan(newProject.id, {
            scan_mode: 'dast_only',
            target_url: newProject.target_url,
          });
        } catch (scanErr: any) {
          console.warn('[NewProjectPage] URL scan trigger warning:', scanErr);
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
    <div className="flex h-screen bg-[#F8FAFD] text-slate-800 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title="New Project" />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Breadcrumb / Back button */}
          <div className="flex items-center gap-3">
            <button
              id="btn-back-to-projects"
              onClick={() => navigate('/projects')}
              className="p-1.5 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="hover:text-slate-900 cursor-pointer font-medium" onClick={() => navigate('/projects')}>
                Projects
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-blue-600 font-semibold">New Project</span>
            </div>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>Create New Project</span>
                <Sparkles className="w-5 h-5 text-blue-600" />
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Configure your application repository or zip archive for continuous security scanning and autonomous patch generation.
              </p>
            </div>

            {/* Error Banner with Retry */}
            {errors.general && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/70 text-rose-700 flex items-start justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-rose-900">Creation Error</h4>
                    <p className="text-xs text-rose-600 mt-0.5">{errors.general}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-medium border border-rose-300 shrink-0 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Source Picker (ZIP | GitHub | URL) */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono">
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
                        ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
                        <GithubIcon className="w-4 h-4" />
                      </div>
                      {sourceType === 'GITHUB' && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3.5">
                      <h4 className="text-xs font-bold text-slate-900">GitHub Repository</h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-snug">
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
                        ? 'bg-amber-50/70 border-amber-500 shadow-sm ring-1 ring-amber-500/20'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-200/60">
                        <FileArchive className="w-4 h-4" />
                      </div>
                      {sourceType === 'ZIP' && (
                        <div className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3.5">
                      <h4 className="text-xs font-bold text-slate-900">ZIP Archive</h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                        Upload direct source bundle (.zip) for isolated sandbox scan.
                      </p>
                    </div>
                  </div>

                  {/* URL Option - Authorized DAST */}
                  <div
                    id="source-picker-url"
                    onClick={() => {
                      setSourceType('URL');
                      setErrors((prev) => ({
                        ...prev,
                        repositoryUrl: undefined,
                        targetUrl: undefined,
                        confirmedOwnership: undefined,
                      }));
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all relative overflow-hidden ${
                      sourceType === 'URL'
                        ? 'bg-sky-50/70 border-sky-500 shadow-sm ring-1 ring-sky-500/20'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-xl bg-sky-100 text-sky-700 border border-sky-200/60">
                        <Globe className="w-4 h-4" />
                      </div>
                      {sourceType === 'URL' && (
                        <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3.5">
                      <h4 className="text-xs font-bold text-slate-900">Live URL Endpoint</h4>
                      <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                        DAST dynamic security scan against authorized web targets.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Source-specific configuration */}
              {sourceType === 'GITHUB' && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">
                      GitHub Repository URL <span className="text-rose-500">*</span>
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
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-50/70 border text-xs text-slate-900 placeholder-slate-400 font-mono focus:bg-white focus:outline-none transition-colors ${
                      errors.repositoryUrl
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                    }`}
                  />
                  {errors.repositoryUrl ? (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1.5">
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
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Upload Archive (.zip) <span className="text-rose-500">*</span>
                  </label>
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-2xl bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors group">
                    <Upload className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform mb-2" />
                    <span className="text-xs font-semibold text-slate-800">
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

              {sourceType === 'URL' && (
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-800 block">
                      Target Web Application URL <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="input-target-url"
                      type="url"
                      value={targetUrl}
                      onChange={(e) => {
                        setTargetUrl(e.target.value);
                        if (errors.targetUrl) setErrors((prev) => ({ ...prev, targetUrl: undefined }));
                      }}
                      placeholder="https://app.example.com"
                      className={`w-full px-4 py-2.5 rounded-xl bg-slate-50/70 border text-xs text-slate-900 placeholder-slate-400 font-mono focus:bg-white focus:outline-none transition-colors ${
                        errors.targetUrl
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                      }`}
                    />
                    {errors.targetUrl && (
                      <p className="text-[11px] text-rose-500 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{errors.targetUrl}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmedOwnership}
                        onChange={(e) => {
                          setConfirmedOwnership(e.target.checked);
                          if (errors.confirmedOwnership) setErrors((prev) => ({ ...prev, confirmedOwnership: undefined }));
                        }}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600 leading-normal">
                        I confirm that I own this domain or have explicit legal authorization to perform security scans against it.
                      </span>
                    </label>
                    {errors.confirmedOwnership && (
                      <p className="mt-1 text-[11px] text-rose-500 pl-6">
                        {errors.confirmedOwnership}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Project Metadata (Name & Description with limits) */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                {/* Project Name (1-80 chars) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">
                      Project Name <span className="text-rose-500">*</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        name.length > 80 ? 'text-rose-500 font-bold' : 'text-slate-400'
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
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-50/70 border text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      errors.name
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                    }`}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                {/* Description (<= 300 chars) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800">
                      Description <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <span
                      className={`text-[11px] font-mono ${
                        description.length > 300 ? 'text-rose-500 font-bold' : 'text-slate-400'
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
                    className={`w-full px-4 py-2.5 rounded-xl bg-slate-50/70 border text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none transition-colors resize-none ${
                      errors.description
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                    }`}
                  />
                  {errors.description && (
                    <p className="text-[11px] text-rose-500 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.description}</span>
                    </p>
                  )}
                </div>

                {/* Framework Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 block">
                    Framework / Environment
                  </label>
                  <input
                    id="input-project-framework"
                    type="text"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    placeholder="e.g., Next.js 15, FastAPI, Django, Express"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  id="btn-cancel-create"
                  onClick={() => navigate('/projects')}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium border border-slate-200/80 transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-project"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-sm active:scale-98 disabled:opacity-50"
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

export default NewProjectPage;
