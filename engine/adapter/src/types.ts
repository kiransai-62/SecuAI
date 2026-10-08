import { FindingSeverity, FindingSource } from '@secuai/shared';

export interface ScanCoverage {
  filesAnalyzed: number;
  rulesExecuted: number;
  dependenciesAnalyzed: number;
  routesDiscovered: number;
  secretsChecksCompleted: boolean;
  configChecksCompleted: boolean;
  durationMs: number;
}

export interface DiscoverySummary {
  technologies: string[];
  frameworks: string[];
  languages: string[];
  packageManagers: string[];
  endpoints: string[];
  apiRoutes: string[];
  authenticationSurfaces: string[];
  sourceFiles: string[];
  configurationFiles: string[];
  manifests: string[];
  scanCoverage: ScanCoverage;
}

export type NormalizedSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type NormalizedConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type NormalizedSource = 'SAST' | 'DAST' | 'SECRETS' | 'SCA' | 'CONFIG';

export type NormalizedFindingStatus =
  | 'OPEN'
  | 'FIX_PROPOSED'
  | 'FIX_APPLIED'
  | 'VERIFIED'
  | 'REGRESSED'
  | 'INCONCLUSIVE'
  | 'ACCEPTED_RISK'
  | 'FALSE_POSITIVE';

export interface FindingEvidence {
  scanner_name: string;
  trigger?: string;
  code_snippet?: string;
  technical_detail?: string;
  missing_control?: string;
  potential_impact?: string;
  remediation_guidance?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  status_code?: number;
  redirects_followed?: number;
  raw_source?: string;
  [key: string]: unknown;
}

export interface NormalizedFinding {
  id: string;
  fingerprint: string;
  title: string;
  category: string;
  severity: NormalizedSeverity;
  confidence: NormalizedConfidence;
  source: NormalizedSource;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  endpoint: string | null;
  parameter: string | null;
  description: string;
  evidence: FindingEvidence;
  remediation: string;
  status: NormalizedFindingStatus;
}

export interface ScanInput {
  targetType: 'REPO' | 'ZIP' | 'URL' | 'LOCAL';
  targetPath?: string;
  repoUrl?: string;
  branch?: string;
  targetUrl?: string;
  confirmedOwnership?: boolean;
  workspacePath: string;
  scanMode?: string;
  options?: {
    timeoutMs?: number;
    enableAi?: boolean;
  };
}

export interface UnifiedScanResult {
  scanId?: string;
  targetType: string;
  targetPath: string;
  discovery: DiscoverySummary;
  findings: NormalizedFinding[];
  score: number;
  metrics: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalFindings: number;
  };
  durationSeconds: number;
  completedAt: string;
}
