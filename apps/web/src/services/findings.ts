import { api } from './api';
import { Finding } from '../types';

export const findingsService = {
  getFindings: () => api.getFindings(),
  getAllFindings: (filters?: { severity?: string; status?: string; query?: string }) => 
    api.getAllFindings(filters),
  getScanFindings: (scanId: string, filters?: { severity?: string; status?: string }) => 
    api.getScanFindings(scanId, filters),
  getFinding: (id: string) => api.getFinding(id),
  updateFindingStatus: (id: string, status: string) => api.updateFindingStatus(id, status),
};

export default findingsService;
