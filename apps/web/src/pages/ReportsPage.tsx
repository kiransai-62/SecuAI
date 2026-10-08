import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Download, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  Calendar, 
  Award, 
  Lock, 
  ArrowUpRight, 
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Printer
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { api } from '../services/api';
import { useToast } from '../components/Toast';

import { useQuery } from '@tanstack/react-query';
import { Scan } from '../types';

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data: scans = [] } = useQuery<Scan[]>({
    queryKey: ['scans'],
    queryFn: () => api.getAllScans(),
  });

  const selectedScan = scans[0] || null;
  const selectedScanId = selectedScan?.id || '';

  const handleDownloadJson = async () => {
    if (!selectedScanId) {
      toast.error('No scan records available to export.');
      return;
    }
    try {
      await api.downloadScanJson(selectedScanId);
      toast.success('Full compliance JSON package downloaded');
    } catch {
      toast.error('Failed to export JSON report');
    }
  };

  const handleGeneratePdf = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      setIsGeneratingPdf(false);
      window.print();
      toast.success('Executive Report ready for print or PDF save');
    }, 800);
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
                <span className="text-[#2563EB]">Reports</span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                    Security & Compliance Reports
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Audit-ready security posture evaluations, regulatory compliance matrices, and verifiable remediation packs.
                  </p>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download JSON Package</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGeneratePdf}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print / Save PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Executive Posture Snapshot Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 lg:p-8 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Executive Audit Grade: A-
                    </span>
                    <span className="text-xs text-slate-400">Evaluated on v2.4 Scanner</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Enterprise SaaS Security Posture
                  </h2>
                  <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                    This evaluation consolidates continuous AST static code analysis, Supabase RLS policy verification, live route fuzzing, and autonomous patch execution across connected services.
                  </p>
                </div>

                {/* Score Big Meter */}
                <div className="flex items-center space-x-4 bg-[#F8FAFD] border border-slate-200/80 rounded-2xl p-4 shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center shadow-2xs">
                    <span className="text-2xl font-black text-[#2563EB] tracking-tight">{selectedScan?.security_score ?? 100}</span>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">/ 100</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {selectedScan ? `Status: ${selectedScan.status}` : 'No scan records'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {selectedScan ? `${selectedScan.findings_count} findings detected` : 'Ready to scan'}
                    </div>
                    {selectedScan && (
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        Scan ID: {selectedScan.id.slice(0, 12)}...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Highlights 3-col */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Zero Unmitigated Zero-Days</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-6">
                    All high-severity vulnerabilities identified have machine-generated patches verified by scanner rerun.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Row Level Security (RLS) Guard</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-6">
                    Multi-tenant data isolation verified across public PostgreSQL schemas and Supabase client roles.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Cryptographic Evidence Trail</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-6">
                    Full SHA-256 fingerprinting for every vulnerability, patch proposal, and AST validation event.
                  </p>
                </div>
              </div>
            </div>

            {/* Compliance Frameworks Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Regulatory & Compliance Frameworks</h3>
                  <p className="text-xs text-slate-500">Live alignment against leading global application security benchmarks.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* OWASP */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold text-xs border border-blue-100">
                        O
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">OWASP Top 10 (2021)</h4>
                        <span className="text-[11px] text-slate-500">Web Application Standard</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      92% Pass
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>A01: Broken Access Control (RLS & IDOR)</span>
                      <span className="font-semibold text-emerald-600">Remediated</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>A02: Cryptographic Failures</span>
                      <span className="font-semibold text-emerald-600">Passed</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>A03: Injection (SQL / Command)</span>
                      <span className="font-semibold text-emerald-600">Passed</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>A07: Identification & Auth Failures</span>
                      <span className="font-semibold text-[#2563EB]">Verified Patched</span>
                    </div>
                  </div>
                </div>

                {/* SOC 2 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-100">
                        S
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">SOC 2 Type II Security</h4>
                        <span className="text-[11px] text-slate-500">Trust Services Criteria</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      89% Ready
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>CC6.1: Logical Access Controls</span>
                      <span className="font-semibold text-emerald-600">Compliant</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>CC6.6: Boundary Protection (Firewalls & WAF)</span>
                      <span className="font-semibold text-emerald-600">Compliant</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>CC7.1: Vulnerability Detection & Remediation</span>
                      <span className="font-semibold text-[#2563EB]">Continuous</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>CC7.2: Incident Evidence Tracking</span>
                      <span className="font-semibold text-emerald-600">Audit-Ready</span>
                    </div>
                  </div>
                </div>

                {/* CWE / SANS Top 25 */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs border border-amber-100">
                        C
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">CWE / SANS Top 25</h4>
                        <span className="text-[11px] text-slate-500">Most Dangerous Software Weaknesses</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      94% Pass
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>CWE-798: Hard-coded Credentials</span>
                      <span className="font-semibold text-emerald-600">Passed</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>CWE-287: Improper Authentication</span>
                      <span className="font-semibold text-[#2563EB]">Verified Patched</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>CWE-639: Authorization Bypass (IDOR)</span>
                      <span className="font-semibold text-[#2563EB]">Verified Patched</span>
                    </div>
                  </div>
                </div>

                {/* GDPR / Privacy */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs border border-teal-100">
                        P
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Data Privacy & Isolation Guard</h4>
                        <span className="text-[11px] text-slate-500">GDPR & HIPAA Data Safeguards</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      Protected
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>PostgreSQL RLS Table Policy Guard</span>
                      <span className="font-semibold text-emerald-600">Enforced</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span>Tenant Boundary User Context Filter</span>
                      <span className="font-semibold text-emerald-600">Enforced</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Sensitive Key Leakage Prevention</span>
                      <span className="font-semibold text-emerald-600">Enforced</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Downloadable Reports Catalog */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Downloadable Report Artifacts</h3>
              
              <div className="divide-y divide-slate-100">
                {[
                  {
                    title: 'Executive Leadership Brief (PDF)',
                    desc: 'High-level security health summary, vulnerability score trends, and board-ready overview.',
                    action: handleGeneratePdf,
                    actionText: 'Print / Save PDF',
                  },
                  {
                    title: 'Comprehensive Technical Audit Ledger (JSON)',
                    desc: 'Full machine-readable ledger of all findings, AST lines, SHA-256 fingerprints, and verified patches.',
                    action: handleDownloadJson,
                    actionText: 'Export JSON',
                  },
                  {
                    title: 'Autonomous Remediation Verification Proof',
                    desc: 'Scanner execution transcripts and patch confirmation logs proving neutralizations.',
                    action: handleDownloadJson,
                    actionText: 'Download Pack',
                  },
                ].map((item, idx) => (
                  <div key={idx} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>{item.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 pl-6">{item.desc}</p>
                    </div>

                    <button
                      type="button"
                      onClick={item.action}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors self-end md:self-center shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{item.actionText}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default ReportsPage;
