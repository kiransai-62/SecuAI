import React from 'react';
import { Shield, Cpu, Sparkles, Database, RefreshCw, Terminal, LogOut } from 'lucide-react';

interface HeaderProps {
  onReScan?: () => void;
  isScanning?: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onReScan, 
  isScanning = false, 
  userEmail, 
  onLogout 
}) => {
  return (
    <header className="border-b border-white/5 bg-[#080c14]/80 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]">
            <Shield className="w-5 h-5" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-white font-mono">SecuAI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Automated AppSec Feedback Loop for AI-Generated Apps</p>
          </div>
        </div>

        {/* Live Architecture Status Badges */}
        <div className="hidden lg:flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Scanner:</span>
            <span className="font-mono text-cyan-300 font-medium">isitsecure</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">AI:</span>
            <span className="font-mono text-purple-300 font-medium">Gemini 3.8</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">DB:</span>
            <span className="font-mono text-emerald-300 font-medium">Postgres RLS</span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Worker:</span>
            <span className="font-mono text-amber-300 font-medium">Zero Redis</span>
          </div>
        </div>

        {/* Action Button & User */}
        <div className="flex items-center space-x-3">
          {onReScan && (
            <button
              onClick={onReScan}
              disabled={isScanning}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-md active:scale-95 ${
                isScanning
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-wait'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold border border-cyan-400/40 shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Workspace...' : 'Run Full Re-Scan'}</span>
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out"
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/5 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
