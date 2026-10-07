import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  FileCode2, 
  Download, 
  ArrowUpRight, 
  Sparkles,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { Finding, FindingSeverity, FindingStatus } from '../types';
import { useToast } from '../components/Toast';

export const FindingsListPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const { data: findings = [], isLoading, refetch } = useQuery({
    queryKey: ['findings', selectedSeverity, selectedStatus],
    queryFn: () => api.getAllFindings({ severity: selectedSeverity, status: selectedStatus }),
  });

  // Calculate metrics
  const totalCount = findings.length;
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const highCount = findings.filter(f => f.severity === 'HIGH').length;
  const verifiedCount = findings.filter(f => (f.status || '').toUpperCase() === 'VERIFIED').length;
  const openCount = findings.filter(f => (f.status || 'OPEN').toUpperCase() === 'OPEN').length;

  // Filtered findings based on client search & category
  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = f.title.toLowerCase().includes(q);
        const matchesDesc = (f.description || '').toLowerCase().includes(q);
        const matchesFile = (f.file_path || '').toLowerCase().includes(q);
        const matchesCategory = (f.category || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesFile && !matchesCategory) return false;
      }
      if (selectedCategory !== 'ALL') {
        if ((f.category || '').toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }
      return true;
    });
  }, [findings, searchQuery, selectedCategory]);

  const getSeverityBadge = (severity: FindingSeverity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      case 'HIGH':
        return 'bg-orange-50 text-orange-700 border-orange-200/80';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200/80';
    }
  };

  const getStatusBadge = (status?: FindingStatus | string) => {
    const s = (status || 'OPEN').toUpperCase();
    if (s === 'VERIFIED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Verified
        </span>
      );
    }
    if (s === 'FIX_PROPOSED' || s === 'PATCH_PROPOSED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#2563EB] border border-blue-200/80">
          <Sparkles className="w-3 h-3 mr-1" />
          Fix Ready
        </span>
      );
    }
    if (s === 'FIX_APPLIED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
          Applied
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Open
      </span>
    );
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(filteredFindings, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secuai-findings-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Findings exported to JSON');
  };

  return (
    <div className="flex h-screen bg-[#F8FAFD] font-sans antialiased text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Breadcrumb & Title */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
                <button 
                  onClick={() => navigate('/dashboard')} 
                  className="hover:text-slate-900 transition-colors"
                >
                  Dashboard
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[#2563EB]">Findings</span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                    Security Findings
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Central vulnerability registry with automated root-cause explanations and verified patch loops.
                  </p>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="p-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-slate-600 transition-colors shadow-2xs"
                    title="Refresh findings"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleExport}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/new-scan')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>New Scan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-semibold text-slate-500 mb-1">Total Findings</div>
                <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{openCount} active needing review</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-semibold text-rose-600 mb-1">Critical Severity</div>
                <div className="text-2xl font-bold text-rose-600">{criticalCount}</div>
                <div className="text-[11px] text-rose-500/80 mt-0.5">High blast radius</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-semibold text-orange-600 mb-1">High Severity</div>
                <div className="text-2xl font-bold text-orange-600">{highCount}</div>
                <div className="text-[11px] text-orange-500/80 mt-0.5">Urgent patch candidate</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-semibold text-emerald-600 mb-1">Verified Patches</div>
                <div className="text-2xl font-bold text-emerald-600">{verifiedCount}</div>
                <div className="text-[11px] text-emerald-600/80 mt-0.5">Scanner neutralized</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by vulnerability title, file path, or category..."
                    className="w-full pl-10 pr-4 py-2 text-xs bg-[#F8FAFD] border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* Status Dropdown */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#F8FAFD] border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:border-[#2563EB]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="FIX_PROPOSED">Fix Proposed</option>
                </select>

                {/* Category Dropdown */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#F8FAFD] border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-hidden focus:border-[#2563EB]"
                >
                  <option value="ALL">All Categories</option>
                  <option value="rls_misconfiguration">RLS Misconfiguration</option>
                  <option value="exposed_secrets">Exposed Secrets</option>
                  <option value="missing_auth">Missing Auth Route</option>
                  <option value="auth_weakness">IDOR / Auth Weakness</option>
                </select>
              </div>

              {/* Severity Tab Pills */}
              <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto">
                <span className="text-[11px] font-semibold text-slate-500 mr-2 flex items-center">
                  <Filter className="w-3 h-3 mr-1 text-slate-400" /> Severity:
                </span>
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
                  const isActive = selectedSeverity === sev;
                  return (
                    <button
                      type="button"
                      key={sev}
                      onClick={() => setSelectedSeverity(sev)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#EBF3FE] text-[#2563EB] border border-blue-200/80 shadow-2xs'
                          : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      {sev}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Findings List Table / Cards */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Vulnerability Ledger ({filteredFindings.length})
                </div>
                <span className="text-xs text-slate-400">
                  Showing matching findings across all scans
                </span>
              </div>

              {isLoading ? (
                <div className="p-12 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-[#2563EB] rounded-full animate-spin mx-auto mb-2" />
                  <span className="text-xs">Loading vulnerabilities...</span>
                </div>
              ) : filteredFindings.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto opacity-75" />
                  <div className="text-sm font-bold text-slate-800">No findings match your criteria</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try adjusting search keywords or resetting severity and status filters.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredFindings.map((finding) => {
                    const findingId = finding.id || finding.fingerprint;
                    return (
                      <div
                        key={finding.fingerprint || finding.id}
                        onClick={() => navigate(`/findings/${findingId}`)}
                        className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-start space-x-3.5 min-w-0">
                          {/* Severity Pill */}
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border shrink-0 mt-0.5 ${getSeverityBadge(
                              finding.severity
                            )}`}
                          >
                            {finding.severity}
                          </span>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors truncate">
                                {finding.title}
                              </h3>
                              {getStatusBadge(finding.status)}
                            </div>

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
                              {finding.confidence && (
                                <span className="text-slate-400 font-sans">
                                  {Math.round(finding.confidence * 100)}% confidence
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Quick Action */}
                        <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/findings/${findingId}`);
                            }}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white group-hover:bg-[#EBF3FE] group-hover:text-[#2563EB] border border-slate-200/80 group-hover:border-blue-200/80 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                          >
                            <span>Inspect & Fix</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default FindingsListPage;
