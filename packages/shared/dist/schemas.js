"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingExplanationSchema = exports.ReScanSchema = exports.VerifyFindingSchema = exports.ProposeDiffSchema = exports.ExplainFindingSchema = exports.CreateScanSchema = exports.UpdateProjectSchema = exports.CreateProjectSchema = exports.SourceTypeSchema = exports.FindingSchema = exports.FindingSourceSchema = exports.FindingSeveritySchema = void 0;
const zod_1 = require("zod");
/**
 * Normalized Finding Schema required by SecuAI platform
 */
exports.FindingSeveritySchema = zod_1.z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
exports.FindingSourceSchema = zod_1.z.enum(['SAST', 'DAST', 'SECRETS', 'DEPS']);
exports.FindingSchema = zod_1.z.object({
    fingerprint: zod_1.z.string().min(1, 'Fingerprint is required'),
    title: zod_1.z.string().min(1, 'Title is required'),
    category: zod_1.z.string().min(1, 'Category is required'),
    severity: exports.FindingSeveritySchema,
    confidence: zod_1.z.number().min(0).max(1),
    source: exports.FindingSourceSchema,
    file_path: zod_1.z.string().nullable(),
    line_start: zod_1.z.number().int().nullable(),
    line_end: zod_1.z.number().int().nullable(),
    endpoint: zod_1.z.string().nullable(),
    evidence: zod_1.z.record(zod_1.z.unknown()),
    description: zod_1.z.string(),
});
exports.SourceTypeSchema = zod_1.z.enum(['ZIP', 'GITHUB', 'URL']);
const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/)?$/;
exports.CreateProjectSchema = zod_1.z
    .object({
    name: zod_1.z
        .string({ required_error: 'Project name is required' })
        .trim()
        .min(1, 'Project name must be between 1 and 80 characters')
        .max(80, 'Project name cannot exceed 80 characters'),
    description: zod_1.z
        .string()
        .trim()
        .max(300, 'Description cannot exceed 300 characters')
        .optional()
        .nullable(),
    source_type: exports.SourceTypeSchema.default('ZIP'),
    repository_url: zod_1.z.string().trim().optional().nullable(),
    repo_url: zod_1.z.string().trim().optional().nullable(), // Backwards compatibility alias
    target_url: zod_1.z.string().trim().optional().nullable(),
    confirmed_ownership: zod_1.z.boolean().optional(),
    framework: zod_1.z.string().trim().max(50).optional().nullable(),
})
    .superRefine((data, ctx) => {
    const ghUrl = data.repository_url || data.repo_url;
    if (data.source_type === 'GITHUB') {
        if (!ghUrl || !GITHUB_REPO_REGEX.test(ghUrl)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Repository URL must follow the exact format https://github.com/<owner>/<repo>',
                path: ['repository_url'],
            });
        }
    }
    else if (data.source_type === 'URL') {
        const targetUrl = data.target_url || ghUrl;
        if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Target URL is required for URL scan and must begin with http:// or https://',
                path: ['target_url'],
            });
        }
        if (!data.confirmed_ownership) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Target ownership confirmation is required for authorized URL scan',
                path: ['confirmed_ownership'],
            });
        }
    }
    else if (ghUrl) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Repository URL is only allowed when source_type is GITHUB',
            path: ['repository_url'],
        });
    }
});
exports.UpdateProjectSchema = zod_1.z
    .object({
    name: zod_1.z
        .string()
        .trim()
        .min(1, 'Project name must be between 1 and 80 characters')
        .max(80, 'Project name cannot exceed 80 characters')
        .optional(),
    description: zod_1.z
        .string()
        .trim()
        .max(300, 'Description cannot exceed 300 characters')
        .optional()
        .nullable(),
    source_type: exports.SourceTypeSchema.optional(),
    repository_url: zod_1.z.string().trim().optional().nullable(),
    repo_url: zod_1.z.string().trim().optional().nullable(),
    framework: zod_1.z.string().trim().max(50).optional().nullable(),
})
    .superRefine((data, ctx) => {
    const url = data.repository_url || data.repo_url;
    if (data.source_type === 'GITHUB') {
        if (!url || !GITHUB_REPO_REGEX.test(url)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Repository URL must follow the exact format https://github.com/<owner>/<repo>',
                path: ['repository_url'],
            });
        }
    }
    else if (url && !data.source_type) {
        // If updating repository_url without changing source_type, ensure valid github url if provided
        if (!GITHUB_REPO_REGEX.test(url)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Repository URL must follow the exact format https://github.com/<owner>/<repo>',
                path: ['repository_url'],
            });
        }
    }
});
exports.CreateScanSchema = zod_1.z.object({
    project_id: zod_1.z.string().uuid('Invalid project UUID'),
    target_type: zod_1.z.enum(['repo', 'upload', 'demo', 'url']),
    target_path: zod_1.z.string().min(1, 'Target path or URL is required'),
    scan_mode: zod_1.z.enum(['code_only', 'full', 'quick', 'url_only', 'dast']).default('code_only'),
    confirmed_ownership: zod_1.z.boolean().optional(),
});
exports.ExplainFindingSchema = zod_1.z.object({
    finding_id: zod_1.z.string().uuid('Invalid finding UUID'),
});
exports.ProposeDiffSchema = zod_1.z.object({
    finding_id: zod_1.z.string().uuid('Invalid finding UUID'),
    user_context: zod_1.z.string().max(500).optional(),
});
exports.VerifyFindingSchema = zod_1.z.object({
    finding_id: zod_1.z.string().uuid('Invalid finding UUID'),
    applied_diff: zod_1.z.string().min(1, 'Diff is required to verify patch'),
});
exports.ReScanSchema = zod_1.z.object({
    scan_id: zod_1.z.string().uuid('Invalid scan UUID'),
});
exports.FindingExplanationSchema = zod_1.z.object({
    summary: zod_1.z.string().describe("What's the problem"),
    why_it_happened: zod_1.z.string().describe('Why it happened'),
    potential_impact: zod_1.z.string().describe('Potential impact'),
    evidence_interpretation: zod_1.z.string().describe('Evidence interpretation'),
    recommended_remediation: zod_1.z.string().describe('Recommended fix'),
    verification_steps: zod_1.z.array(zod_1.z.string()).describe('Steps to verify the fix'),
});
