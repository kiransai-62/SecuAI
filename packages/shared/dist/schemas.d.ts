import { z } from 'zod';
/**
 * Normalized Finding Schema required by SecuAI platform
 */
export declare const FindingSeveritySchema: z.ZodEnum<["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]>;
export declare const FindingSourceSchema: z.ZodEnum<["SAST", "DAST", "SECRETS", "DEPS"]>;
export declare const FindingSchema: z.ZodObject<{
    fingerprint: z.ZodString;
    title: z.ZodString;
    category: z.ZodString;
    severity: z.ZodEnum<["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]>;
    confidence: z.ZodNumber;
    source: z.ZodEnum<["SAST", "DAST", "SECRETS", "DEPS"]>;
    file_path: z.ZodNullable<z.ZodString>;
    line_start: z.ZodNullable<z.ZodNumber>;
    line_end: z.ZodNullable<z.ZodNumber>;
    endpoint: z.ZodNullable<z.ZodString>;
    evidence: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    fingerprint: string;
    title: string;
    category: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    confidence: number;
    source: "SAST" | "DAST" | "SECRETS" | "DEPS";
    file_path: string | null;
    line_start: number | null;
    line_end: number | null;
    endpoint: string | null;
    evidence: Record<string, unknown>;
    description: string;
}, {
    fingerprint: string;
    title: string;
    category: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    confidence: number;
    source: "SAST" | "DAST" | "SECRETS" | "DEPS";
    file_path: string | null;
    line_start: number | null;
    line_end: number | null;
    endpoint: string | null;
    evidence: Record<string, unknown>;
    description: string;
}>;
export type Finding = z.infer<typeof FindingSchema>;
export declare const SourceTypeSchema: z.ZodEnum<["ZIP", "GITHUB", "URL"]>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export declare const CreateProjectSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    source_type: z.ZodDefault<z.ZodEnum<["ZIP", "GITHUB", "URL"]>>;
    repository_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    repo_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    framework: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    source_type: "ZIP" | "GITHUB" | "URL";
    description?: string | null | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    source_type?: "ZIP" | "GITHUB" | "URL" | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}>, {
    name: string;
    source_type: "ZIP" | "GITHUB" | "URL";
    description?: string | null | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
    source_type?: "ZIP" | "GITHUB" | "URL" | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}>;
export declare const UpdateProjectSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    source_type: z.ZodOptional<z.ZodEnum<["ZIP", "GITHUB", "URL"]>>;
    repository_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    repo_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    framework: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    description?: string | null | undefined;
    name?: string | undefined;
    source_type?: "ZIP" | "GITHUB" | "URL" | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}, {
    description?: string | null | undefined;
    name?: string | undefined;
    source_type?: "ZIP" | "GITHUB" | "URL" | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}>, {
    description?: string | null | undefined;
    name?: string | undefined;
    source_type?: "ZIP" | "GITHUB" | "URL" | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}, {
    description?: string | null | undefined;
    name?: string | undefined;
    source_type?: "ZIP" | "GITHUB" | "URL" | undefined;
    repository_url?: string | null | undefined;
    repo_url?: string | null | undefined;
    framework?: string | null | undefined;
}>;
export declare const CreateScanSchema: z.ZodObject<{
    project_id: z.ZodString;
    target_type: z.ZodEnum<["repo", "upload", "demo"]>;
    target_path: z.ZodString;
    scan_mode: z.ZodDefault<z.ZodEnum<["code_only", "full", "quick"]>>;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    target_type: "repo" | "upload" | "demo";
    target_path: string;
    scan_mode: "code_only" | "full" | "quick";
}, {
    project_id: string;
    target_type: "repo" | "upload" | "demo";
    target_path: string;
    scan_mode?: "code_only" | "full" | "quick" | undefined;
}>;
export declare const ExplainFindingSchema: z.ZodObject<{
    finding_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    finding_id: string;
}, {
    finding_id: string;
}>;
export declare const ProposeDiffSchema: z.ZodObject<{
    finding_id: z.ZodString;
    user_context: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    finding_id: string;
    user_context?: string | undefined;
}, {
    finding_id: string;
    user_context?: string | undefined;
}>;
export declare const VerifyFindingSchema: z.ZodObject<{
    finding_id: z.ZodString;
    applied_diff: z.ZodString;
}, "strip", z.ZodTypeAny, {
    finding_id: string;
    applied_diff: string;
}, {
    finding_id: string;
    applied_diff: string;
}>;
export declare const ReScanSchema: z.ZodObject<{
    scan_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    scan_id: string;
}, {
    scan_id: string;
}>;
export declare const FindingExplanationSchema: z.ZodObject<{
    summary: z.ZodString;
    why_it_happened: z.ZodString;
    potential_impact: z.ZodString;
    evidence_interpretation: z.ZodString;
    recommended_remediation: z.ZodString;
    verification_steps: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    summary: string;
    why_it_happened: string;
    potential_impact: string;
    evidence_interpretation: string;
    recommended_remediation: string;
    verification_steps: string[];
}, {
    summary: string;
    why_it_happened: string;
    potential_impact: string;
    evidence_interpretation: string;
    recommended_remediation: string;
    verification_steps: string[];
}>;
export type FindingExplanation = z.infer<typeof FindingExplanationSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateScanInput = z.infer<typeof CreateScanSchema>;
export type ExplainFindingInput = z.infer<typeof ExplainFindingSchema>;
export type ProposeDiffInput = z.infer<typeof ProposeDiffSchema>;
export type VerifyFindingInput = z.infer<typeof VerifyFindingSchema>;
export type ReScanInput = z.infer<typeof ReScanSchema>;
