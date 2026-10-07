import React from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  FolderGit2, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      path: '/dashboard', 
      active: location.pathname === '/dashboard' 
    },
    { 
      label: 'Projects', 
      icon: FolderGit2, 
      path: '/projects', 
      active: location.pathname.startsWith('/projects') 
    },
    { 
      label: 'Settings', 
      icon: Settings, 
      path: '/settings', 
      active: location.pathname === '/settings' 
    },
  ];

  return (
    <aside className="w-60 bg-[#090d16] border-r border-slate-800 hidden md:flex flex-col justify-between p-4 shrink-0 font-sans">
      <div>
        {/* Brand Header */}
        <div className="flex items-center space-x-2.5 px-2 py-3 mb-6">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#4F46E5] text-white">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
              <span>SecuAI</span>
            </div>
            <p className="text-[11px] text-slate-400">Application Security</p>
          </div>
        </div>

        {/* Navigation Items: Dashboard, Projects, Settings */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                id={`sidebar-nav-${item.label.toLowerCase()}`}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  item.active
                    ? 'bg-[#4F46E5] text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile & Logout */}
      <div className="pt-4 border-t border-slate-800 space-y-2">
        <div className="p-2.5 rounded-md bg-[#0f172a] border border-slate-800 flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-xs font-semibold shrink-0">
            {user?.email ? user.email.slice(0, 2).toUpperCase() : 'AI'}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate" title={user?.email || 'User'}>
              {user?.email || 'User'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">RLS Active</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          id="sidebar-logout-button"
          className="w-full flex items-center justify-center space-x-2 py-1.5 px-3 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
