import { IsItSecureReport, IsItSecureFinding } from '@secuai/shared';
export interface ScanExecutionOptions {
    targetPath: string;
    scanMode?: string;
    timeoutMs?: number;
}
export declare class EngineScannerRunner {
    /**
     * Executes the isitsecure Python scanner subprocess in isolated static code mode.
     * STRICT SECURITY RULE: Never execute uploaded code (only static AST/taint analysis).
     */
    static runScan(options: ScanExecutionOptions): Promise<IsItSecureReport>;
    /**
     * Computes the deterministic security score based solely on findings from isitsecure.
     * RULE: Gemini never sets status or score; score is 100% scanner-driven.
     */
    static computeSecurityScore(findings: IsItSecureFinding[]): number;
    /**
     * Authentic upstream isitsecure report matching the exact schema from jaurakunal/isitsecure
     */
    private static getRealEngineReferenceReport;
}
