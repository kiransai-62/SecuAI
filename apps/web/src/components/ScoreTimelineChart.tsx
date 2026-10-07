import React, { useState } from 'react';

export interface TimelineScan {
  id: string;
  created_at: string;
  security_score?: number | null;
  status?: string;
}

export interface ScoreTimelineChartProps {
  scans: TimelineScan[];
  height?: number;
  className?: string;
}

export const ScoreTimelineChart: React.FC<ScoreTimelineChartProps> = ({
  scans,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filter and sort chronologically (oldest to newest)
  const validScans = [...scans]
    .filter((s) => s && s.created_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (validScans.length === 0) {
    return (
      <div className={`p-8 text-center text-xs text-slate-400 font-mono ${className}`}>
        No scan scores recorded yet.
      </div>
    );
  }

  // Dimensions
  const svgWidth = 600;
  const svgHeight = 160;
  const padding = { top: 24, right: 36, bottom: 28, left: 42 };
  const innerWidth = svgWidth - padding.left - padding.right;
  const innerHeight = svgHeight - padding.top - padding.bottom;

  // Coordinate mapper
  const points = validScans.map((scan, i) => {
    const rawScore = scan.security_score ?? 100;
    const score = Math.max(0, Math.min(100, rawScore));
    const x =
      validScans.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (i / (validScans.length - 1)) * innerWidth;
    const y = padding.top + (1 - score / 100) * innerHeight;
    return {
      x,
      y,
      score,
      scan,
      index: i,
    };
  });

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPolygonStr =
    points.length > 1
      ? `${points[0].x},${padding.top + innerHeight} ${polylineStr} ${
          points[points.length - 1].x
        },${padding.top + innerHeight}`
      : '';

  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  // Grid tick lines at [0, 25, 50, 75, 100]
  const ticks = [0, 25, 50, 75, 100];

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#06b6d4'; // cyan
    if (score >= 60) return '#10b981'; // emerald
    if (score >= 40) return '#f59e0b'; // amber
    return '#f43f5e'; // rose
  };

  const latestScore = points[points.length - 1]?.score ?? 100;
  const lineColor = getScoreColor(latestScore);

  return (
    <div className={`relative w-full ${className}`}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto overflow-visible select-none"
        aria-label="Security score timeline line chart"
      >
        <defs>
          <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Horizontal gridlines and Y-axis labels */}
        {ticks.map((tick) => {
          const y = padding.top + (1 - tick / 100) * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerWidth}
                y2={y}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeDasharray={tick === 0 || tick === 100 ? 'none' : '3 3'}
                strokeWidth={tick === 0 || tick === 100 ? '1' : '0.75'}
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                fill="rgba(148, 163, 184, 0.7)"
                fontSize="9"
                fontFamily="monospace"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Baseline area fill under the line */}
        {points.length > 1 && (
          <polygon
            points={areaPolygonStr}
            fill="url(#scoreAreaGradient)"
          />
        )}

        {/* Single point guide line when only 1 scan exists */}
        {points.length === 1 && (
          <line
            x1={padding.left}
            y1={points[0].y}
            x2={padding.left + innerWidth}
            y2={points[0].y}
            stroke={lineColor}
            strokeDasharray="4 4"
            strokeWidth="1.5"
            strokeOpacity="0.5"
          />
        )}

        {/* Score timeline polyline */}
        {points.length > 1 && (
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylineStr}
            filter="url(#glow)"
          />
        )}

        {/* Data points & hover targets */}
        {points.map((pt, i) => {
          const isHovered = hoveredIdx === i;
          const ptColor = getScoreColor(pt.score);
          const dateStr = new Date(pt.scan.created_at).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          });

          return (
            <g
              key={pt.scan.id || i}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Invisible large hover hit area */}
              <circle cx={pt.x} cy={pt.y} r={16} fill="transparent" />

              {/* Outer pulsing ring when hovered */}
              {isHovered && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={9}
                  fill="none"
                  stroke={ptColor}
                  strokeWidth="2"
                  strokeOpacity="0.6"
                />
              )}

              {/* Data point circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isHovered ? 5.5 : 3.5}
                fill={ptColor}
                stroke="#090d16"
                strokeWidth={isHovered ? 2 : 1.5}
              />

              {/* X-axis date labels */}
              {(points.length <= 6 || i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0) && (
                <text
                  x={pt.x}
                  y={padding.top + innerHeight + 16}
                  textAnchor="middle"
                  fill="rgba(148, 163, 184, 0.7)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {dateStr}
                </text>
              )}
            </g>
          );
        })}

        {/* Interactive Tooltip Callout */}
        {hoveredPoint && (
          <g transform={`translate(${Math.min(Math.max(hoveredPoint.x, 80), svgWidth - 80)}, ${Math.max(hoveredPoint.y - 36, 16)})`}>
            {/* Tooltip Background */}
            <rect
              x="-60"
              y="-14"
              width="120"
              height="26"
              rx="6"
              fill="#0b1120"
              stroke={getScoreColor(hoveredPoint.score)}
              strokeWidth="1"
              filter="url(#glow)"
            />
            {/* Tooltip Text */}
            <text
              x="0"
              y="3"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {`Score: ${hoveredPoint.score}/100`}
            </text>
          </g>
        )}
      </svg>

      {/* Legend & Summary Footer */}
      <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>&ge;80 Good</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>60-79 Moderate</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>40-59 Warning</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>&lt;40 Critical</span>
          </span>
        </div>

        <div className="text-right">
          <span>{validScans.length} data point{validScans.length === 1 ? '' : 's'} recorded</span>
        </div>
      </div>
    </div>
  );
};
