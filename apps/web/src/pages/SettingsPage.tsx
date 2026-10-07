import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Shield, User, Key, Server, LogOut, CheckCircle, Unlink, Link2, Check, AlertCircle } from 'lucide-react';
import { useToast } from '../components/Toast';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

export const SettingsPage: React.FC = () => {
  const { user, logout, loginWithOAuth } = useAuth();
  const toast = useToast();

  const [githubPat, setGithubPat] = useState('');
  const [isPatSaved, setIsPatSaved] = useState(false);
  const [connectedGithubUser, setConnectedGithubUser] = useState<string | null>(null);

  useEffect(() => {
    const savedPat = localStorage.getItem('secuai_github_pat');
    if (savedPat) {
      setGithubPat(savedPat);
      setIsPatSaved(true);
    }
    const savedUser = localStorage.getItem('secuai_github_username');
    if (savedUser) {
      setConnectedGithubUser(savedUser);
    } else if (user?.user_metadata?.user_name || user?.app_metadata?.provider === 'github') {
      if (!localStorage.getItem('secuai_github_disconnected')) {
        setConnectedGithubUser(user?.user_metadata?.user_name || user?.email?.split('@')[0] || 'github-user');
      }
    }
  }, [user]);

  const handleSavePat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubPat.trim()) {
      localStorage.removeItem('secuai_github_pat');
      setIsPatSaved(false);
      toast.success('GitHub Personal Access Token cleared.');
      return;
    }
    localStorage.setItem('secuai_github_pat', githubPat.trim());
    setIsPatSaved(true);
    toast.success('New GitHub Access Token saved successfully!');
  };

  const handleDisconnectGithub = () => {
    localStorage.removeItem('secuai_github_pat');
    localStorage.removeItem('secuai_github_username');
    localStorage.setItem('secuai_github_disconnected', 'true');
    setConnectedGithubUser(null);
    setGithubPat('');
    setIsPatSaved(false);
    toast.success('Disconnected from GitHub account. You can now link a different account or token.');
  };

  const handleConnectOtherGithub = async () => {
    localStorage.removeItem('secuai_github_disconnected');
    try {
      await loginWithOAuth('github');
    } catch {
      toast.error('Unable to initiate GitHub OAuth account chooser.');
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFD] text-slate-800 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-5xl w-full mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings & Integrations</h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage GitHub account connections, authentication tokens, and application security configurations.
            </p>
          </div>

          {/* GitHub Integration Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                  <GithubIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">GitHub Account Connection</h2>
                  <p className="text-xs text-slate-500">Connect, switch, or provide credentials for repository scanning</p>
                </div>
              </div>

              {connectedGithubUser ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                  Connected as @{connectedGithubUser}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                  Not Connected
                </span>
              )}
            </div>

            {/* Actions for Switching or Disconnecting */}
            <div className="bg-[#F8FAFD] border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {connectedGithubUser ? 'Switch or Unlink GitHub Account' : 'Link Other GitHub Account'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Disconnect the current account to provide another GitHub username or organization credentials.
                </div>
              </div>

              <div className="flex items-center gap-2">
                {connectedGithubUser && (
                  <button
                    type="button"
                    onClick={handleDisconnectGithub}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 border border-slate-200/80 text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConnectOtherGithub}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-xs"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Connect Other GitHub</span>
                </button>
              </div>
            </div>

            {/* Custom GitHub Personal Access Token (PAT) for Private Repos */}
            <form onSubmit={handleSavePat} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  GitHub Personal Access Token (PAT)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Paste a fine-grained or classic token (<code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">ghp_...</code>) from your other account to scan private code repositories.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={githubPat}
                    onChange={(e) => setGithubPat(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 px-3.5 py-2 text-xs bg-[#F8FAFD] border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] text-slate-900 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs shrink-0"
                  >
                    {isPatSaved ? 'Update Token' : 'Save Token'}
                  </button>
                </div>
              </div>
              {isPatSaved && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  <span>Active GitHub token saved locally for authenticated git clones</span>
                </div>
              )}
            </form>
          </div>

          {/* Account Profile Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Account Profile</h2>
                <p className="text-xs text-slate-500">Authenticated user identity</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium block mb-1">Email Address</span>
                <span className="font-mono text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 block">
                  {user?.email || 'developer@secuai.dev'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block mb-1">Tenant ID</span>
                <span className="font-mono text-slate-800 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 block truncate">
                  {user?.id || '00000000-0000-0000-0000-000000000001'}
                </span>
              </div>
            </div>
          </div>

          {/* Security & RLS Policy Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Security & Tenant Isolation</h2>
                <p className="text-xs text-slate-500">Row Level Security (RLS) enforcement</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>PostgreSQL Row Level Security (RLS) is active on all tables.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Cross-tenant access attempts return HTTP 404 to prevent ID enumeration.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Redis / BullMQ dependency — worker polls Postgres via SKIP LOCKED.</span>
              </div>
            </div>
          </div>

          {/* Sign Out Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Session Management</h2>
              <p className="text-xs text-slate-500">Sign out of current active workstation</p>
            </div>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200/80 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
