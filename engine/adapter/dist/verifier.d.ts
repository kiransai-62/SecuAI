import { IsItSecureFinding } from '@secuai/shared';
export interface VerificationResult {
    verified: boolean;
    engine_verdict: 'PASSED' | 'FAILED' | 'INCONCLUSIVE';
    scanner_name: string;
    verification_time: string;
    message: string;
    evidence_text?: string;
    note?: string;
}
export declare class EngineVerifier {
    /**
     * Deterministically verifies whether a proposed patch neutralizes the finding.
     * RULE: The scanner engine alone decides verification status, NOT Gemini.
     */
    static verifyPatch(finding: IsItSecureFinding | any, appliedDiff: string): VerificationResult;
}
