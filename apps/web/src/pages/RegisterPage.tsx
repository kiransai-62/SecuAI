import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const { register, session, user, isLoading } = useAuth();
  const navigate = useNavigate();

  // If user is already authenticated, don't show register page; forward directly to Dashboard
  React.useEffect(() => {
    if (!isLoading && session && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, user, isLoading, navigate]);

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

  if (!isLoading && session && user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-slate-800 flex flex-col font-sans selection:bg-blue-500/20 selection:text-blue-700">
      <header className="w-full px-6 lg:px-12 py-5 flex items-center justify-between z-20">
        <Link to="/" className="flex items-center gap-2.5 text-slate-900 group">
          <div className="w-7 h-7 rounded-lg bg-slate-950 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <Shield className="w-4 h-4 fill-white text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-950">SecuAI</span>
        </Link>
        <div className="text-xs">
          <span className="text-slate-500 mr-2">Already have an account?</span>
          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-full border border-slate-300 text-slate-700 font-medium hover:bg-white hover:border-slate-400 hover:shadow-xs transition"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center py-8 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-950 text-white shadow-sm mb-4">
            <Shield className="w-6 h-6 fill-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Create SecuAI Account
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Autonomous security scanner for your AI software
          </p>
        </div>

        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xs rounded-3xl border border-slate-200/80 sm:px-10 space-y-6">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/70 flex items-start space-x-2.5 text-xs text-rose-600 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email Field */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Work Email
                </label>
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
                    placeholder="engineer@company.com"
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-white rounded-xl border text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                      emailError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                    }`}
                  />
                </div>
                {emailError && (
                  <p className="mt-1 text-[11px] text-rose-500">
                    {emailError}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-white rounded-xl border text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                      passwordError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                    }`}
                  />
                </div>
                {passwordError && (
                  <p className="mt-1 text-[11px] text-rose-500">
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                    className={`w-full pl-10 pr-3.5 py-2.5 bg-white rounded-xl border text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                      confirmPasswordError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'
                    }`}
                  />
                </div>
                {confirmPasswordError && (
                  <p className="mt-1 text-[11px] text-rose-500">
                    {confirmPasswordError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Creating Secure Account...' : 'Create Account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-150">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
