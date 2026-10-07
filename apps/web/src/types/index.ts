export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingSeverity = Severity;
export type FindingSource = 'SAST' | 'DAST' | 'SECRETS' | 'DEPS';

export type FindingStatus =
  | 'OPEN'
  | 'FIX_PROPOSED'
  | 'FIX_APPLIED'
  | 'VERIFIED'
  | 'REGRESSED'
  | 'INCONCLUSIVE'
  | 'ACCEPTED_RISK'
  | 'FALSE_POSITIVE'
  | 'detected'
  | 'explaining'
  | 'patch_proposed'
  | 'verified'
  | 're_scanned';

export type SecurityScoreLabel =
  | 'Excellent'
  | 'Good'
  | 'Needs work'
  | 'At risk'
  | 'Production Ready'
  | 'Ship with Confidence'
  | 'Needs Review'
  | 'Security Gaps'
  | 'High Risk'
  | 'Critical Risk';

export type ScanProgressStep =
  | 'Preparing'
  | 'Detecting project'
  | 'Scanning'
  | 'Normalizing'
  | 'Scoring'
  | 'Done';

export interface FindingExplanation {
  summary: string;
  why_it_happened: string;
  potential_impact: string;
  evidence_interpretation: string;
  recommended_remediation: string;
  verification_steps: string[];
}

export interface Finding {
  id?: string;
  scan_id?: string;
  project_id?: string;
  fingerprint: string;
  title: string;
  category: string;
  severity: Severity;
  confidence: number;
  source: FindingSource;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  endpoint: string | null;
  evidence: Record<string, any>;
  description: string;
  status?: FindingStatus;
  explanation?: string;
  proposed_diff?: string;
  proposed_fix?: string;
  verification_result?: {
    verified: boolean;
    engine_verdict: string;
    scanner_name: string;
    message: string;
    evidence_text?: string;
    note?: string;
  };
}

export interface Project {
  id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  source_type: 'ZIP' | 'GITHUB' | 'URL';
  repository_url?: string | null;
  repo_url?: string | null;
  target_url?: string | null;
  confirmed_ownership?: boolean;
  framework?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ScanCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface Scan {
  id: string;
  project_id: string;
  user_id?: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress_step?: string | null;
  scan_mode?: string;
  target_type: string;
  target_path: string;
  storage_path?: string | null;
  workspace_path?: string | null;
  confirmed_ownership?: boolean;
  findings_count?: number;
  critical_count?: number;
  high_count?: number;
  medium_count?: number;
  low_count?: number;
  security_score?: number;
  score?: number;
  counts?: ScanCounts;
  scan_duration_seconds?: number;
  started_at?: string;
  completed_at?: string;
  error?: string | null;
  created_at: string;
}

export type LoopStep = 'DETECT' | 'EXPLAIN' | 'FIX' | 'VERIFY' | 'RE_SCAN';
