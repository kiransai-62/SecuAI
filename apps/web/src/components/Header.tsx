import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Bell, 
  Folder, 
  ChevronDown,
  Check,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../types';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  projects?: Project[];
  currentProject?: Project | null;
  onSelectProject?: (project: Project) => void;
  onSearchFocus?: () => void;
  userEmail?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
  title = 'AI Assistant', 
  onBack,
  showBack = true,
  projects = [],
  currentProject,
  onSelectProject,
  onSearchFocus,
  userEmail = 'john@company.com'
}) => {
  const navigate = useNavigate();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [hasUnread] = useState(true);

  const name = userEmail.split('@')[0] || 'John Doe';
  const initials = (name.slice(0, 2) || 'JD').toUpperCase();

  const projectName = currentProject?.name || 'my-ai-app';

  return (
    <header className="h-16 px-6 border-b border-slate-200/80 bg-white/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-20 font-sans">
      {/* Left Title / Breadcrumb */}
      <div className="flex items-center space-x-3 min-w-[200px]">
        {showBack && (
          <button
            onClick={onBack || (() => navigate(-1))}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <h1 className="text-sm font-semibold text-slate-800 tracking-tight">
          {title}
        </h1>
      </div>

      {/* Center Search Input Pill */}
      <div className="flex-1 max-w-xl mx-4">
        <div 
          onClick={onSearchFocus}
          className="relative flex items-center w-full px-3.5 py-2 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl text-xs text-slate-500 cursor-text transition-colors group"
        >
          <Search className="w-3.5 h-3.5 mr-2.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
          <input
            type="text"
            placeholder="Ask about your code, security issues, or fixes..."
            onFocus={onSearchFocus}
            className="w-full bg-transparent border-none outline-none text-xs text-slate-800 placeholder-slate-400 cursor-text"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 bg-white border border-slate-200 rounded shadow-2xs shrink-0">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Actions: Project Pill, Bell, Avatar */}
      <div className="flex items-center space-x-3.5 shrink-0">
        {/* Project Selector Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 shadow-2xs transition-colors text-xs"
          >
            <Folder className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 hidden lg:inline">Current project:</span>
            <span className="font-semibold text-slate-800 max-w-[120px] truncate">{projectName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {showProjectDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 z-50 text-xs">
              <div className="px-2 py-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Select Project
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {projects.length > 0 ? (
                  projects.map((p) => {
                    const isSelected = p.id === currentProject?.id || p.name === projectName;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (onSelectProject) onSelectProject(p);
                          setShowProjectDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <button
                    onClick={() => {
                      if (onSelectProject) onSelectProject({ id: 'my-ai-app', name: 'my-ai-app' } as any);
                      setShowProjectDropdown(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left bg-blue-50 text-blue-700 font-semibold"
                  >
                    <span>my-ai-app</span>
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  </button>
                )}
              </div>
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setShowProjectDropdown(false);
                    navigate('/projects/new');
                  }}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* User Avatar Circle */}
        <div 
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-400/50 transition-all shadow-2xs"
          title={userEmail}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};

export default Header;
