import { RawIsItSecureReport } from '@secuai/shared';
export interface RunScanOptions {
    timeoutMs?: number;
    isitsecureBin?: string;
    depth?: 'quick' | 'deep';
    verbose?: boolean;
}
/**
 * Resolves the isitsecure executable path across Windows and Linux/macOS environments.
 */
export declare function resolveIsItSecureBinary(customBin?: string): string;
/**
 * Spawns the isitsecure CLI without shell, captures JSON report, and enforces timeout.
 *
 * @param workspacePath Path to the target workspace or repository
 * @param options Timeout and binary override options
 */
export declare function runScan(workspacePath: string, options?: RunScanOptions): Promise<RawIsItSecureReport>;
