import React from 'react';
import { Severity } from '../types';

interface SeverityBadgeProps {
  severity?: Severity | string;
}

/**
 * Minimalist severity indicator: text + dot
 * Requirement: severity shown as text + dot.
 */
export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const sev = String(severity || 'INFO').toUpperCase();

  const dotColor = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-amber-500',
    LOW: 'bg-blue-500',
    INFO: 'bg-slate-400',
  }[sev] || 'bg-slate-400';

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />
      <span>{sev}</span>
    </span>
  );
};
