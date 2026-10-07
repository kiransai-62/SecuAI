import React from 'react';
import { Shield, RefreshCw, LogOut } from 'lucide-react';

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
    <header className="border-b border-slate-800 bg-[#090d16] sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#4F46E5] text-white">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold tracking-tight text-white font-sans">SecuAI</span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Automated AppSec Feedback Loop</p>
          </div>
        </div>

        {/* Action Button & User */}
        <div className="flex items-center space-x-3">
          {onReScan && (
            <button
              onClick={onReScan}
              disabled={isScanning}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isScanning
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-wait'
                  : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Run Full Re-Scan'}</span>
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out"
              className="md:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
