import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans antialiased text-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center space-x-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-105">
            <Shield className="w-5 h-5 fill-white text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            SecuAI
          </span>
        </Link>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1.5 text-xs text-slate-500 max-w-xs mx-auto">
          {subtitle}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 border border-slate-200/80 rounded-3xl shadow-xs">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
