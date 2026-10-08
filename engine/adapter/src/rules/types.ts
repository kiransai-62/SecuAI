export type RuleCategory =
  | 'INJECTION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'INPUT_VALIDATION'
  | 'SECRETS'
  | 'SECURITY_HEADERS'
  | 'CORS'
  | 'SESSION_SECURITY'
  | 'CRYPTOGRAPHY'
  | 'FILE_HANDLING'
  | 'PATH_TRAVERSAL'
  | 'SSRF'
  | 'XSS'
  | 'CSRF'
  | 'DEPENDENCIES'
  | 'ERROR_HANDLING'
  | 'CONFIGURATION'
  | 'API_SECURITY';

export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type RuleConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RuleMatch {
  ruleId: string;
  title: string;
  category: RuleCategory;
  severity: RuleSeverity;
  confidence: RuleConfidence;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  endpoint?: string | null;
  parameter?: string | null;
  trigger: string;
  codeSnippet: string;
  description: string;
  missingControl: string;
  potentialImpact: string;
  remediation: string;
}

export interface RuleExecutionContext {
  filePath: string;
  fileContent: string;
  workspacePath: string;
  lines: string[];
}

export interface SecurityRule {
  id: string;
  name: string;
  category: RuleCategory;
  severity: RuleSeverity;
  confidence: RuleConfidence;
  description: string;
  missingControl: string;
  potentialImpact: string;
  remediation: string;
  applicableExtensions?: string[];
  execute(context: RuleExecutionContext): RuleMatch[];
}
