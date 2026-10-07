import { api } from './api';
import { Scan } from '../types';

export const scansService = {
  getScan: (id?: string) => api.getScan(id),
  getAllScans: () => api.getAllScans(),
  createProjectScan: (projectId: string, payload?: any) => api.createProjectScan(projectId, payload),
  startScan: (projectId: string, payload?: any) => api.startScan(projectId, payload),
  retryScan: (scanId: string) => api.retryScan(scanId),
  reScan: (scanId?: string) => api.reScan(scanId),
  exportScanJson: (scanId: string) => api.exportScanJson(scanId),
  downloadScanJson: (scanId: string) => api.downloadScanJson(scanId),
};

export default scansService;
