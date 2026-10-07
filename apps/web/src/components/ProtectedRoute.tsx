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
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center space-y-4 font-sans">
        <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-950 text-white shadow-sm animate-pulse">
          <Shield className="w-6 h-6 fill-white" />
        </div>
        <div className="text-xs text-slate-500 font-medium">
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
