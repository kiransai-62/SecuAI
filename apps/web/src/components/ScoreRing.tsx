import React, { useState, useEffect, useRef } from 'react';
import { SecurityScoreLabel } from '../types';

interface ScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  label?: SecurityScoreLabel;
}

export function getScoreLabel(score: number): SecurityScoreLabel {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'At risk';
}

interface ScoreRingTheme {
  stroke: string;
  bgStroke: string;
  glow: string;
  textColor: string;
  badgeBg: string;
}

const SCORE_THEMES: Record<SecurityScoreLabel, ScoreRingTheme> = {
  Excellent: {
    stroke: '#06b6d4',
    bgStroke: 'rgba(6, 182, 212, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(6,182,212,0.4)]',
    textColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  },
  'Production Ready': {
    stroke: '#06b6d4',
    bgStroke: 'rgba(6, 182, 212, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(6,182,212,0.4)]',
    textColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  },
  Good: {
    stroke: '#10b981',
    bgStroke: 'rgba(16, 185, 129, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(16,185,129,0.4)]',
    textColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  'Ship with Confidence': {
    stroke: '#10b981',
    bgStroke: 'rgba(16, 185, 129, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(16,185,129,0.4)]',
    textColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  'Needs Review': {
    stroke: '#f59e0b',
    bgStroke: 'rgba(245, 158, 11, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(245,158,11,0.4)]',
    textColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  'Needs work': {
    stroke: '#f59e0b',
    bgStroke: 'rgba(245, 158, 11, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(245,158,11,0.4)]',
    textColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  'Security Gaps': {
    stroke: '#f97316',
    bgStroke: 'rgba(249, 115, 22, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(249,115,22,0.4)]',
    textColor: 'text-orange-400',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  },
  'At risk': {
    stroke: '#f43f5e',
    bgStroke: 'rgba(244, 63, 94, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(244,63,94,0.4)]',
    textColor: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
  'High Risk': {
    stroke: '#f43f5e',
    bgStroke: 'rgba(244, 63, 94, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(244,63,94,0.4)]',
    textColor: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
  'Critical Risk': {
    stroke: '#e11d48',
    bgStroke: 'rgba(225, 29, 72, 0.15)',
    glow: 'shadow-[0_0_25px_-5px_rgba(225,29,72,0.4)]',
    textColor: 'text-rose-500',
    badgeBg: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  },
};

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 'md',
  showLabel = true,
  className = '',
  label: customLabel,
}) => {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const label = customLabel || getScoreLabel(clampedScore);

  // 150ms animation respecting prefers-reduced-motion
  const [displayScore, setDisplayScore] = useState(clampedScore);
  const prevScoreRef = useRef(clampedScore);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayScore(clampedScore);
      prevScoreRef.current = clampedScore;
      return;
    }

    const start = prevScoreRef.current;
    const end = clampedScore;
    if (start === end) return;

    const duration = 150; // 150ms requirement
    const startTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const current = Math.round(start + (end - start) * progress);
      setDisplayScore(current);
      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      } else {
        prevScoreRef.current = end;
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [clampedScore]);

  const dimensions = {
    sm: { size: 80, stroke: 6, fontSize: 'text-lg', labelSize: 'text-[10px]' },
    md: { size: 120, stroke: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
    lg: { size: 160, stroke: 10, fontSize: 'text-4xl', labelSize: 'text-sm' },
  }[size];

  const radius = (dimensions.size - dimensions.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  const theme = SCORE_THEMES[label] ?? SCORE_THEMES['At risk'];

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center ${className}`}
      role="progressbar"
      aria-valuenow={displayScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Security score: ${displayScore} out of 100 (${label})`}
    >
      <div
        className={`relative flex items-center justify-center rounded-full ${theme.glow}`}
        style={{ width: dimensions.size, height: dimensions.size }}
      >
        <svg
          width={dimensions.size}
          height={dimensions.size}
          className="rotate-[-90deg] transition-all duration-150 ease-out motion-reduce:transition-none"
        >
          {/* Background circle track */}
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={radius}
            stroke={theme.bgStroke}
            strokeWidth={dimensions.stroke}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={dimensions.size / 2}
            cy={dimensions.size / 2}
            r={radius}
            stroke={theme.stroke}
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-150 ease-out motion-reduce:transition-none"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
          <span className={`font-mono font-bold tracking-tight ${dimensions.fontSize} text-slate-900 transition-all duration-150 motion-reduce:transition-none`}>
            {displayScore}
          </span>
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
            / 100
          </span>
        </div>
      </div>

      {/* Categorical Text Label (Never color-only) */}
      {showLabel && (
        <div className="mt-2 text-center">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-medium font-mono ${theme.badgeBg}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: theme.stroke }}
              aria-hidden="true"
            />
            {label}
          </span>
        </div>
      )}
    </div>
  );
};
