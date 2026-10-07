import { useQuery } from '@tanstack/react-query';
import { scansService } from '../services/scans';

export const useScan = (scanId?: string) => {
  return useQuery({
    queryKey: ['scan', scanId],
    queryFn: () => scansService.getScan(scanId),
    refetchInterval: (query) => {
      const status = query.state.data?.status?.toUpperCase();
      return status === 'QUEUED' || status === 'RUNNING' ? 2000 : false;
    },
  });
};

export default useScan;
