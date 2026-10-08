import { ScanInput, DiscoverySummary, NormalizedFinding } from '../types.js';

export abstract class SecurityScannerAdapter {
  abstract readonly name: string;

  /**
   * Executes deterministic security scanning against the workspace target.
   */
  abstract scan(input: ScanInput, discovery: DiscoverySummary): Promise<NormalizedFinding[]>;
}
