import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { session, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#05070c] flex flex-col items-center justify-center space-y-4">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 animate-pulse">
          <Shield className="w-7 h-7" />
        </div>
        <div className="text-xs font-mono text-slate-400">
          Verifying security session...
        </div>
      </div>
    );
  }

  if (!session || !user) {
    // Redirect unauthenticated requests to /login, preserving target location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
