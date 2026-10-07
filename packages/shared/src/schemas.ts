import { z } from 'zod';

/**
 * Normalized Finding Schema required by SecuAI platform
 */
export const FindingSeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

export const FindingSourceSchema = z.enum(['SAST', 'DAST', 'SECRETS', 'DEPS']);

export const FindingSchema = z.object({
  fingerprint: z.string().min(1, 'Fingerprint is required'),
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  severity: FindingSeveritySchema,
  confidence: z.number().min(0).max(1),
  source: FindingSourceSchema,
  file_path: z.string().nullable(),
  line_start: z.number().int().nullable(),
  line_end: z.number().int().nullable(),
  endpoint: z.string().nullable(),
  evidence: z.record(z.unknown()),
  description: z.string(),
});

export type Finding = z.infer<typeof FindingSchema>;

export const SourceTypeSchema = z.enum(['ZIP', 'GITHUB', 'URL']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\/)?$/;

export const CreateProjectSchema = z
  .object({
    name: z
      .string({ required_error: 'Project name is required' })
      .trim()
      .min(1, 'Project name must be between 1 and 80 characters')
      .max(80, 'Project name cannot exceed 80 characters'),
    description: z
      .string()
      .trim()
      .max(300, 'Description cannot exceed 300 characters')
      .optional()
      .nullable(),
    source_type: SourceTypeSchema.default('ZIP'),
    repository_url: z.string().trim().optional().nullable(),
    repo_url: z.string().trim().optional().nullable(), // Backwards compatibility alias
    target_url: z.string().trim().optional().nullable(),
    confirmed_ownership: z.boolean().optional(),
    framework: z.string().trim().max(50).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const ghUrl = data.repository_url || data.repo_url;
    if (data.source_type === 'GITHUB') {
      if (!ghUrl || !GITHUB_REPO_REGEX.test(ghUrl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Repository URL must follow the exact format https://github.com/<owner>/<repo>',
          path: ['repository_url'],
        });
      }
    } else if (data.source_type === 'URL') {
      const targetUrl = data.target_url || ghUrl;
      if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Target URL is required for URL scan and must begin with http:// or https://',
          path: ['target_url'],
        });
      }
      if (!data.confirmed_ownership) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Target ownership confirmation is required for authorized URL scan',
          path: ['confirmed_ownership'],
        });
      }
    } else if (ghUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Repository URL is only allowed when source_type is GITHUB',
        path: ['repository_url'],
      });
    }
  });

export const UpdateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Project name must be between 1 and 80 characters')
      .max(80, 'Project name cannot exceed 80 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(300, 'Description cannot exceed 300 characters')
      .optional()
      .nullable(),
    source_type: SourceTypeSchema.optional(),
    repository_url: z.string().trim().optional().nullable(),
    repo_url: z.string().trim().optional().nullable(),
    framework: z.string().trim().max(50).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const url = data.repository_url || data.repo_url;
    if (data.source_type === 'GITHUB') {
      if (!url || !GITHUB_REPO_REGEX.test(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Repository URL must follow the exact format https://github.com/<owner>/<repo>',
          path: ['repository_url'],
        });
      }
    } else if (url && !data.source_type) {
      // If updating repository_url without changing source_type, ensure valid github url if provided
      if (!GITHUB_REPO_REGEX.test(url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Repository URL must follow the exact format https://github.com/<owner>/<repo>',
          path: ['repository_url'],
        });
      }
    }
  });

export const CreateScanSchema = z.object({
  project_id: z.string().uuid('Invalid project UUID'),
  target_type: z.enum(['repo', 'upload', 'demo', 'url']),
  target_path: z.string().min(1, 'Target path or URL is required'),
  scan_mode: z.enum(['code_only', 'full', 'quick', 'url_only', 'dast']).default('code_only'),
  confirmed_ownership: z.boolean().optional(),
});

export const ExplainFindingSchema = z.object({
  finding_id: z.string().uuid('Invalid finding UUID'),
});

export const ProposeDiffSchema = z.object({
  finding_id: z.string().uuid('Invalid finding UUID'),
  user_context: z.string().max(500).optional(),
});

export const VerifyFindingSchema = z.object({
  finding_id: z.string().uuid('Invalid finding UUID'),
  applied_diff: z.string().min(1, 'Diff is required to verify patch'),
});

export const ReScanSchema = z.object({
  scan_id: z.string().uuid('Invalid scan UUID'),
});

export const FindingExplanationSchema = z.object({
  summary: z.string().describe("What's the problem"),
  why_it_happened: z.string().describe('Why it happened'),
  potential_impact: z.string().describe('Potential impact'),
  evidence_interpretation: z.string().describe('Evidence interpretation'),
  recommended_remediation: z.string().describe('Recommended fix'),
  verification_steps: z.array(z.string()).describe('Steps to verify the fix'),
});

export type FindingExplanation = z.infer<typeof FindingExplanationSchema>;

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type CreateScanInput = z.infer<typeof CreateScanSchema>;
export type ExplainFindingInput = z.infer<typeof ExplainFindingSchema>;
export type ProposeDiffInput = z.infer<typeof ProposeDiffSchema>;
export type VerifyFindingInput = z.infer<typeof VerifyFindingSchema>;
export type ReScanInput = z.infer<typeof ReScanSchema>;
