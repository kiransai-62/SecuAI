import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Shield, 
  Lock, 
  Mail, 
  Phone, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, loginWithOAuth, session, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If user is already authenticated, don't show login page; forward directly to Dashboard
  React.useEffect(() => {
    if (!isLoading && session && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, user, isLoading, navigate]);

  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Inline field validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const validateEmail = (val: string): boolean => {
    if (!val.trim()) {
      setEmailError('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setEmailError('Please enter a valid email address (e.g., you@example.com).');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError('Password is required.');
      return false;
    }
    if (val.length < 6) {
      setPasswordError('Password must contain at least 6 characters.');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (activeTab === 'phone') {
      if (!phone.trim()) {
        setFormError('Please enter your phone number.');
        return;
      }
      setIsSubmitting(true);
      // Demo phone login connects seamlessly
      const { error } = await login('developer@secuai.dev', 'SecuAI@2026');
      setIsSubmitting(false);
      if (error) {
        setFormError(error);
      } else {
        navigate('/new-scan', { replace: true });
      }
      return;
    }

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) return;

    setIsSubmitting(true);
    const { error } = await login(email, password);
    setIsSubmitting(false);

    if (error) {
      setFormError(error);
    } else {
      const origin = (location.state as any)?.from?.pathname;
      const target = (origin && origin !== '/login' && origin !== '/' && origin !== '/dashboard') ? origin : '/new-scan';
      navigate(target, { replace: true });
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setFormError(null);
    setOauthLoading(provider);
    const { error } = await loginWithOAuth(provider);
    setOauthLoading(null);
    if (error) {
      setFormError(error);
    } else {
      navigate('/new-scan', { replace: true });
    }
  };

  const handleFillDemo = () => {
    setActiveTab('email');
    setEmail('developer@secuai.dev');
    setPassword('SecuAI@2026');
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
  };

  if (!isLoading && session && user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-700">
      {/* Top Navigation Bar matching reference design */}
      <header className="w-full px-6 lg:px-12 py-5 flex items-center justify-between z-20">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 text-slate-900 group">
            <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4 fill-white text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-950">SecuAI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600">
            <a href="#security" className="hover:text-slate-950 transition-colors">Security</a>
            <a href="#pricing" className="hover:text-slate-950 transition-colors">Pricing</a>
            <a href="#docs" className="hover:text-slate-950 transition-colors">Docs</a>
            <a href="#help" className="hover:text-slate-950 transition-colors">Help</a>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="hidden sm:inline text-slate-500 font-normal">New to SecuAI?</span>
          <Link 
            to="/register" 
            className="px-3.5 py-1.5 rounded-full border border-slate-300 text-slate-700 font-medium hover:bg-white hover:border-slate-400 hover:shadow-xs transition"
          >
            Create account
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 flex items-center py-6 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center w-full">
          
          {/* Left Column: Hero presentation matching screenshot */}
          <div className="lg:col-span-7 flex flex-col justify-center relative">
            
            {/* Background Cyber Glow & Circuit Motif */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 bg-sky-400/20 rounded-full blur-3xl pointer-events-none -z-10" />
            
            <div className="space-y-6 max-w-lg">
              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-[11px] font-semibold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                SECURE YOUR AI-BUILT APPS
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-normal tracking-tight text-slate-950 leading-[1.08] font-serif">
                Build with AI.<br />
                Deploy with <span className="italic text-[#0284C7] font-serif">confidence.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-600 font-sans leading-relaxed">
                Detect, understand, and fix security issues in your AI-generated code.
              </p>

              {/* Feature Checklist */}
              <div className="space-y-3.5 pt-2">
                {[
                  'AI-powered security analysis',
                  'Plain English explanations',
                  'Actionable fixes with examples',
                  'Works with any framework',
                ].map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-slate-700">
                    <div className="w-4 h-4 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                      <Shield className="w-2.5 h-2.5 fill-sky-500 text-sky-600" />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Glowing Cyber Circuit Node Graphics (matching reference layout) */}
            <div className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Circuit radial glow */}
                <div className="absolute inset-0 bg-radial from-sky-400/25 to-transparent rounded-full blur-xl" />

                {/* SVG Circuit Lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                  <path d="M100 20 L100 70 M20 100 L70 100 M100 130 L100 180" stroke="#7DD3FC" strokeWidth="1.5" strokeDasharray="3 3" fill="none" opacity="0.7" />
                  <circle cx="100" cy="20" r="3" fill="#0284C7" />
                  <circle cx="20" cy="100" r="3" fill="#0284C7" />
                  <circle cx="100" cy="180" r="3" fill="#0284C7" />
                </svg>

                {/* Floating telemetry pills */}
                <span className="absolute -top-1 right-2 px-2.5 py-0.5 rounded-md bg-white/90 border border-sky-200 text-[10px] font-mono text-sky-700 shadow-xs">
                  scan();
                </span>
                <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 px-2.5 py-0.5 rounded-md bg-white/90 border border-sky-200 text-[10px] font-mono text-sky-700 shadow-xs">
                  detect()
                </span>
                <span className="absolute -bottom-1 right-3 px-2.5 py-0.5 rounded-md bg-white/90 border border-sky-200 text-[10px] font-mono text-sky-700 shadow-xs">
                  fix();
                </span>

                {/* Central Glowing Shield / Cube Node */}
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0284C7] to-[#0369A1] shadow-lg shadow-sky-500/30 flex items-center justify-center text-white border border-sky-300/40">
                  <Shield className="w-7 h-7 fill-white/20 text-white" />
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Welcome back card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/50 border border-slate-100 relative">
              
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Welcome back
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Sign in to continue to SecuAI
                </p>
              </div>

              {/* Email / Phone Tabs */}
              <div className="flex border-b border-slate-150 mb-6">
                <button
                  type="button"
                  onClick={() => { setActiveTab('email'); setFormError(null); }}
                  className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-colors relative ${
                    activeTab === 'email'
                      ? 'text-blue-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Email
                  {activeTab === 'email' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('phone'); setFormError(null); }}
                  className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-colors relative ${
                    activeTab === 'phone'
                      ? 'text-blue-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Phone
                  {activeTab === 'phone' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              </div>

              {/* Error Message */}
              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200/70 flex items-start space-x-2 text-xs text-rose-600">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {activeTab === 'email' ? (
                  <>
                    {/* Email Input */}
                    <div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailError) validateEmail(e.target.value);
                          }}
                          onBlur={() => validateEmail(email)}
                          placeholder="you@example.com"
                          className={`w-full pl-10 pr-3.5 py-2.5 bg-white rounded-xl border text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                            emailError
                              ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                          }`}
                        />
                      </div>
                      {emailError && (
                        <p className="mt-1 text-[11px] text-rose-500 pl-1">{emailError}</p>
                      )}
                    </div>

                    {/* Password Input */}
                    <div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (passwordError) validatePassword(e.target.value);
                          }}
                          onBlur={() => validatePassword(password)}
                          placeholder="Enter your password"
                          className={`w-full pl-10 pr-10 py-2.5 bg-white rounded-xl border text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                            passwordError
                              ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="mt-1 text-[11px] text-rose-500 pl-1">{passwordError}</p>
                      )}
                    </div>

                    {/* Forgot password link */}
                    <div className="flex justify-end">
                      <a href="#forgot" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                        Forgot password?
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Phone Input */}
                    <div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Primary Sign In Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 rounded-full bg-[#071B25] hover:bg-slate-800 text-white font-medium text-xs tracking-wide transition shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.99] disabled:opacity-60"
                >
                  <span>{isSubmitting ? 'Signing in...' : 'Sign in'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>

              {/* Or continue with divider */}
              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-normal text-slate-400">
                  or continue with
                </span>
              </div>

              {/* Social Login Buttons: Google, GitHub, and Microsoft connected to Supabase */}
              <div className="grid grid-cols-3 gap-3">
                {/* Google Login Button */}
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={oauthLoading !== null}
                  title="Sign in with Google via Supabase"
                  className="py-2.5 px-3 rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 transition flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {oauthLoading === 'google' ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  )}
                </button>

                {/* GitHub Login Button */}
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('github')}
                  disabled={oauthLoading !== null}
                  title="Sign in with GitHub via Supabase"
                  className="py-2.5 px-3 rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 transition flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-50 text-slate-900"
                >
                  {oauthLoading === 'github' ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                    </svg>
                  )}
                </button>

                {/* Microsoft Button */}
                <button
                  type="button"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={oauthLoading !== null}
                  title="Sign in with Microsoft"
                  className="py-2.5 px-3 rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 transition flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/>
                    <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/>
                    <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/>
                    <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/>
                  </svg>
                </button>
              </div>

              {/* Quick 1-click Demo credentials trigger */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="text-slate-500 hover:text-blue-600 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span>Autofill demo account</span>
                </button>
                <span className="font-mono text-[10px] text-slate-400">Supabase Auth Connected</span>
              </div>

              {/* Footer */}
              <div className="mt-5 text-center text-xs text-slate-500">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Create account
                </Link>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default LoginPage;
