import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    info: (msg: string) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start p-3.5 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-3 ${
              item.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : item.type === 'error'
                ? 'bg-rose-950/80 border-rose-500/30 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                : 'bg-cyan-950/80 border-cyan-500/30 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
            }`}
          >
            <div className="shrink-0 mr-3 mt-0.5">
              {item.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {item.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {item.type === 'info' && <Info className="w-4 h-4 text-cyan-400" />}
            </div>
            <div className="flex-1 text-xs font-medium leading-relaxed">{item.message}</div>
            <button
              onClick={() => removeToast(item.id)}
              className="shrink-0 ml-2 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
