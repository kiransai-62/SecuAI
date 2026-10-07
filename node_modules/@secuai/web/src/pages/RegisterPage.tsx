import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Inline errors
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (val: string): boolean => {
    if (!val.trim()) {
      setEmailError('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setEmailError('Please enter a valid email address.');
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

  const validateConfirmPassword = (val: string, pwd: string): boolean => {
    if (!val) {
      setConfirmPasswordError('Please confirm your password.');
      return false;
    }
    if (val !== pwd) {
      setConfirmPasswordError('Passwords do not match.');
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirmPassword(confirmPassword, password);

    if (!isEmailValid || !isPasswordValid || !isConfirmValid) return;

    setIsSubmitting(true);
    const { error } = await register(email, password);
    setIsSubmitting(false);

    if (error) {
      setFormError(error);
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400 shadow-[0_0_25px_-5px_rgba(6,182,212,0.4)] mb-4">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white font-mono">
          Create SecuAI Account
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Autonomous security scanner for your AI software
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0a0e1a]/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-white/10 sm:px-10 space-y-6">
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
                Work Email
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
                  placeholder="engineer@company.com"
                  className={`w-full pl-9 pr-3 py-2.5 bg-[#05070c] rounded-xl border text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                    emailError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                  }`}
                />
              </div>
              {emailError && (
                <p className="mt-1 text-[11px] text-rose-400">
                  {emailError}
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
                  placeholder="At least 6 characters"
                  className={`w-full pl-9 pr-3 py-2.5 bg-[#05070c] rounded-xl border text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                    passwordError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                  }`}
                />
              </div>
              {passwordError && (
                <p className="mt-1 text-[11px] text-rose-400">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) validateConfirmPassword(e.target.value, password);
                  }}
                  onBlur={() => validateConfirmPassword(confirmPassword, password)}
                  placeholder="Repeat your password"
                  className={`w-full pl-9 pr-3 py-2.5 bg-[#05070c] rounded-xl border text-xs text-white placeholder-slate-600 focus:outline-none transition-all ${
                    confirmPasswordError
                      ? 'border-rose-500/60 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                  }`}
                />
              </div>
              {confirmPasswordError && (
                <p className="mt-1 text-[11px] text-rose-400">
                  {confirmPasswordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 border border-cyan-300/40 shadow-[0_0_20px_-5px_rgba(6,182,212,0.4)] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Creating Secure Account...' : 'Create Account'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="text-center text-xs text-slate-400 pt-2 border-t border-white/5">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
