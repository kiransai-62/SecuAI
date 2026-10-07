import React from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Key, Server, LogOut, CheckCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
            <p className="text-xs text-slate-400 mt-1">
              Account settings, tenant configuration, and application security parameters.
            </p>
          </div>

          {/* Account & Profile Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
              <div className="w-8 h-8 rounded-md bg-[#4F46E5]/10 border border-[#4F46E5]/30 flex items-center justify-center text-[#4F46E5]">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Account Profile</h2>
                <p className="text-xs text-slate-400">Authenticated user identity</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Email Address</span>
                <span className="font-mono text-slate-200 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 block">
                  {user?.email || 'authenticated-user@secuai.dev'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">User Identifier (Tenant ID)</span>
                <span className="font-mono text-slate-200 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 block truncate">
                  {user?.id || '00000000-0000-0000-0000-000000000001'}
                </span>
              </div>
            </div>
          </div>

          {/* Security & RLS Policy Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
              <div className="w-8 h-8 rounded-md bg-[#4F46E5]/10 border border-[#4F46E5]/30 flex items-center justify-center text-[#4F46E5]">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Security & Tenant Isolation</h2>
                <p className="text-xs text-slate-400">Row Level Security (RLS) enforcement</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#4F46E5]" />
                <span>PostgreSQL Row Level Security (RLS) is active on all tables.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#4F46E5]" />
                <span>Cross-tenant access attempts return HTTP 404 to prevent ID enumeration.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#4F46E5]" />
                <span>Zero Redis / BullMQ dependency — worker polls Postgres via SKIP LOCKED.</span>
              </div>
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-3">
              <div className="w-8 h-8 rounded-md bg-[#4F46E5]/10 border border-[#4F46E5]/30 flex items-center justify-center text-[#4F46E5]">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Engine Configuration</h2>
                <p className="text-xs text-slate-400">Analysis & scanner parameters</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Scanning Engine</span>
                <span className="font-mono text-slate-200 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 block">
                  isitsecure (v0.32.2 pinned)
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">AI Explanations & Patches</span>
                <span className="font-mono text-slate-200 bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 block">
                  Gemini Flash (Server-Side Only)
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-lg p-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-white">Sign Out</h2>
              <p className="text-xs text-slate-400">End your current session on this device</p>
            </div>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 rounded-md text-xs font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
