import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Inline field validation errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (val: string): boolean => {
    if (!val.trim()) {
      setEmailError('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setEmailError('Please enter a valid email address (e.g., engineer@secuai.dev).');
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

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) return;

    setIsSubmitting(true);
    const { error } = await login(email, password);
    setIsSubmitting(false);

    if (error) {
      setFormError(error);
    } else {
      const origin = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(origin, { replace: true });
    }
  };

  const handleFillDemo = () => {
    setEmail('developer@secuai.dev');
    setPassword('SecuAI@2026');
    setEmailError(null);
    setPasswordError(null);
    setFormError(null);
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Animated Brand Shield */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 shadow-[0_0_25px_-5px_rgba(6,182,212,0.4)] mb-4">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white font-mono">
          SecuAI
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Sign in to access your autonomous AppSec feedback loop
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0a0e1a]/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-white/10 sm:px-10 space-y-6">
          {/* General Form Error Banner */}
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
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
                  placeholder="developer@secuai.dev"
                  className={`w-full pl-9 pr-3 py-2.5 bg-[#05070c] rounded-xl border text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                    emailError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                  }`}
                />
              </div>
              {emailError && (
                <p className="mt-1 text-[11px] text-rose-400 flex items-center space-x-1">
                  <span>{emailError}</span>
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={() => validatePassword(password)}
                  placeholder="••••••••••••"
                  className={`w-full pl-9 pr-3 py-2.5 bg-[#05070c] rounded-xl border text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                    passwordError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="mt-1 text-[11px] text-rose-400 flex items-center space-x-1">
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 border border-cyan-300/40 shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium text-slate-400 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all text-[11px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Autofill Demo Credentials</span>
            </button>
          </div>

          {/* Link to Register */}
          <div className="text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
            >
              Create one now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
