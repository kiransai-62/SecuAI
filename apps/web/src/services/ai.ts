import { api } from './api';
import { FindingExplanation, FindingStatus } from '../types';

export const aiService = {
  explainFinding: (fingerprint: string) => api.explainFinding(fingerprint),
  explainFindingDetailed: (id: string) => api.explainFindingDetailed(id),
  proposeDiff: (fingerprint: string) => api.proposeDiff(fingerprint),
  generateFix: (findingId: string) => api.generateFix(findingId),
  applyFix: (findingId: string, diff?: string) => api.applyFix(findingId, diff),
  verifyFinding: (findingId: string, diff?: string) => api.verifyFinding(findingId, diff),
};

export default aiService;
