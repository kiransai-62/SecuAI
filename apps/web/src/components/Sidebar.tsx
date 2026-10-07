import React, { useState } from 'react';
import { 
  Shield, 
  Folder, 
  Clock, 
  Settings, 
  ChevronsLeft,
  Sparkles,
  ScanLine,
  Crown,
  MoreVertical,
  LogOut,
  LayoutDashboard,
  ShieldAlert,
  FileText,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { 
      label: 'New Scan', 
      icon: ScanLine, 
      path: '/new-scan', 
      active: location.pathname === '/new-scan' || location.pathname === '/projects/new' || location.pathname === '/' || location.pathname === '/dashboard'
    },
    { 
      label: 'Projects', 
      icon: Folder, 
      path: '/projects', 
      active: location.pathname.startsWith('/projects') && location.pathname !== '/projects/new'
    },
    { 
      label: 'Findings', 
      icon: ShieldAlert, 
      path: '/findings', 
      active: location.pathname.startsWith('/findings') 
    },
    { 
      label: 'History', 
      icon: Clock, 
      path: '/history', 
      active: location.pathname === '/history' || (location.pathname.startsWith('/scans') && !location.pathname.startsWith('/scans/')) 
    },
    { 
      label: 'Reports', 
      icon: FileText, 
      path: '/reports', 
      active: location.pathname === '/reports' 
    },
    { 
      label: 'AI Assistant', 
      icon: Sparkles, 
      path: '/assistant', 
      active: location.pathname === '/assistant' 
    },
    { 
      label: 'Settings', 
      icon: Settings, 
      path: '/settings', 
      active: location.pathname === '/settings' 
    },
  ];

  // Derive initials and display name
  const email = user?.email || 'john@company.com';
  const name = user?.email ? user.email.split('@')[0] : 'John Doe';
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);
  const initials = (name.slice(0, 2) || 'JD').toUpperCase();

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-slate-200/80 hidden md:flex flex-col justify-between p-4 shrink-0 font-sans select-none z-30">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-3 mb-6">
          <div 
            onClick={() => navigate('/assistant')} 
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-950 text-white shadow-sm transition-transform group-hover:scale-105">
              <Shield className="w-4 h-4 fill-white text-white" />
            </div>
            <div className="text-base font-bold text-slate-900 tracking-tight font-sans">
              SecuAI
            </div>
          </div>
          <button 
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                id={`sidebar-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  item.active
                    ? 'bg-[#EBF3FE] text-[#2563EB] font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${item.active ? 'text-[#2563EB]' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Pro Plan & User Row */}
      <div className="space-y-3 pt-4">
        {/* Pro Plan Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-[#FAFCFF] p-3.5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-600 flex items-center justify-center text-xs">
                <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              </div>
              <span className="text-xs font-semibold text-slate-800">Pro Plan</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">1,240 / 5,000 scans</span>
          </div>

          <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#2563EB] h-full rounded-full w-[25%]" />
          </div>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="w-full py-1.5 px-3 rounded-xl bg-[#EBF3FE] hover:bg-blue-100 text-[#2563EB] font-semibold text-xs transition-colors border border-blue-200/50 text-center"
          >
            Upgrade
          </button>
        </div>

        {/* User Profile Row */}
        <div className="relative pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-400 truncate" title={email}>
                  {email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* User popup menu */}
          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 p-1 z-50 text-xs">
              <button
                onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Account Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
