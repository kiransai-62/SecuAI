export declare const FindingSeverity: {
    readonly CRITICAL: "CRITICAL";
    readonly HIGH: "HIGH";
    readonly MEDIUM: "MEDIUM";
    readonly LOW: "LOW";
    readonly INFO: "INFO";
};
export type FindingSeverity = (typeof FindingSeverity)[keyof typeof FindingSeverity];
export declare const FindingSource: {
    readonly SAST: "SAST";
    readonly DAST: "DAST";
    readonly SECRETS: "SECRETS";
    readonly DEPS: "DEPS";
};
export type FindingSource = (typeof FindingSource)[keyof typeof FindingSource];
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type LoopPhase = 'DETECT' | 'EXPLAIN' | 'FIX' | 'VERIFY' | 'RE_SCAN';
export type FindingLifecycleStatus = 'detected' | 'explaining' | 'patch_proposed' | 'verified' | 're_scanned';
/**
 * Raw isitsecure CodeLocation JSON structure (from upstream engine)
 */
export interface RawCodeLocation {
    file_path: string;
    line_number: number | null;
    line_end: number | null;
    code_snippet: string;
    github_url: string;
}
/**
 * Raw isitsecure Finding JSON structure
 */
export interface RawIsItSecureFinding {
    id: string;
    source: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    technical_detail: string;
    evidence: string;
    confidence: number;
    scanner_name: string;
    impact: string | null;
    likelihood: string | null;
    priority: string | null;
    remediation_guidance: string;
    endpoint_url: string | null;
    http_method: string | null;
    request_payload: string | null;
    response_preview: string | null;
    baseline_response_preview?: string | null;
    code_location: RawCodeLocation;
    theme_id: string;
    probe_captures: unknown[];
    related_finding_ids: string[];
    fingerprint?: string;
}
export type IsItSecureFinding = RawIsItSecureFinding;
/**
 * Raw isitsecure Report JSON structure
 */
export interface RawIsItSecureReport {
    target_url: string | null;
    repo_url: string | null;
    repo_branch: string | null;
    repo_commit_hash: string | null;
    framework: string | null;
    backend: string | null;
    scan_mode: string;
    total_endpoints_discovered: number;
    endpoints_with_ids: number;
    endpoints_tested: number;
    routes_in_code: number;
    tables_discovered: number;
    owner_summary: unknown | null;
    findings: RawIsItSecureFinding[];
    discovered_endpoints: unknown[];
    idor_results: unknown[];
    scan_duration_seconds: number;
    scanners_run: string[];
    themes: unknown[];
    token_usage: unknown | null;
}
export type IsItSecureReport = RawIsItSecureReport;
export interface Project {
    id: string;
    user_id: string;
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
export interface Scan {
    id: string;
    project_id: string;
    user_id: string;
    status: ScanStatus;
    progress_step?: string | null;
    scan_mode?: string;
    target_type: string;
    target_path: string;
    storage_path?: string | null;
    workspace_path?: string | null;
    confirmed_ownership?: boolean;
    result_json?: unknown | null;
    findings_count?: number;
    critical_count?: number;
    high_count?: number;
    medium_count?: number;
    low_count?: number;
    security_score?: number;
    scan_duration_seconds?: number;
    started_at?: string;
    completed_at?: string;
    error?: string | null;
    created_at: string;
}
export interface FindingRecord {
    id: string;
    scan_id: string;
    project_id: string;
    user_id: string;
    fingerprint: string;
    engine_finding_id?: string;
    source: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    technical_detail?: string;
    evidence: unknown;
    confidence: number;
    scanner_name?: string;
    file_path: string | null;
    line_number?: number | null;
    line_start?: number | null;
    line_end?: number | null;
    endpoint?: string | null;
    code_snippet?: string | null;
    raw_finding?: RawIsItSecureFinding | null;
    status: string;
    explanation?: string;
    proposed_diff?: string;
    verification_result?: unknown;
    created_at: string;
    updated_at?: string;
}
