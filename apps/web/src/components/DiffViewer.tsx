import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  diffText: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = diffText.split('\n');

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-xs font-mono shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span className="text-[11px] font-semibold text-slate-200">Unified Patch Diff (Git Format)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          <span className="text-[10px] font-semibold">{copied ? 'Copied' : 'Copy Patch'}</span>
        </button>
      </div>

      <div className="p-3 overflow-x-auto max-h-72 space-y-0.5">
        {lines.map((line, index) => {
          let lineClass = 'text-slate-400';
          let bgClass = '';

          if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass = 'text-cyan-300 font-semibold';
            bgClass = 'bg-cyan-500/10 px-1 rounded';
          } else if (line.startsWith('@@')) {
            lineClass = 'text-purple-400 font-semibold';
            bgClass = 'bg-purple-500/10 px-1 rounded';
          } else if (line.startsWith('+')) {
            lineClass = 'text-emerald-300 font-medium';
            bgClass = 'bg-emerald-500/15 border-l-2 border-emerald-500 px-1.5 py-0.5 rounded-sm';
          } else if (line.startsWith('-')) {
            lineClass = 'text-rose-300 font-medium line-through opacity-80';
            bgClass = 'bg-rose-500/15 border-l-2 border-rose-500 px-1.5 py-0.5 rounded-sm';
          }

          return (
            <div key={index} className={`font-mono text-[11px] leading-relaxed select-text ${bgClass} ${lineClass}`}>
              {line || ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
};
