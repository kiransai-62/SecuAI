import { 
  Shield, 
  LayoutDashboard, 
  Terminal, 
  Search, 
  FileCode, 
  LogOut, 
  User as UserIcon, 
  Lock,
  ChevronRight,
  FolderGit2
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
      label: 'Projects', 
      icon: FolderGit2, 
      path: '/projects', 
      active: location.pathname.startsWith('/projects') 
    },
    { 
      label: 'Feedback Loop', 
      icon: LayoutDashboard, 
      path: '/dashboard', 
      active: location.pathname === '/dashboard' 
    },
    { 
      label: 'Vulnerability Catalog', 
      icon: Search, 
      path: '/dashboard', 
      active: false 
    },
    { 
      label: 'Scanner CLI', 
      icon: Terminal, 
      path: '/dashboard', 
      active: false 
    },
  ];

  return (
    <aside className="w-64 bg-[#080c14]/90 border-r border-white/5 hidden md:flex flex-col justify-between p-4 shrink-0">
      <div>
        {/* Logo / Header */}
        <div className="flex items-center space-x-3 px-2 py-3 mb-6">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-1.5">
              <span>SecuAI</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Autonomous AppSec</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="space-y-1">
          <span className="px-3 text-[10px] font-mono uppercase text-slate-400 tracking-wider">
            Workspace
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    item.active
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-[0_0_15px_-3px_rgba(6,182,212,0.15)] font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.active && <ChevronRight className="w-3 h-3 text-cyan-400" />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User profile & Logout Section in Sidebar */}
      <div className="pt-4 border-t border-white/5 space-y-3">
        {/* User Card */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold shrink-0">
            {user?.email ? user.email.slice(0, 2).toUpperCase() : 'AI'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-medium text-slate-200 truncate" title={user?.email || 'User'}>
              {user?.email || 'Authenticated User'}
            </p>
            <div className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>RLS Active</span>
            </div>
          </div>
        </div>

        {/* Logout Button in Sidebar */}
        <button
          onClick={handleLogout}
          id="sidebar-logout-button"
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/10 hover:border-rose-500/30 transition-all active:scale-[0.98]"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
