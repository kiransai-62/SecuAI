import { useQuery } from '@tanstack/react-query';
import { findingsService } from '../services/findings';

export const useFindings = (filters?: { severity?: string; status?: string; query?: string }) => {
  return useQuery({
    queryKey: ['findings', filters],
    queryFn: () => findingsService.getAllFindings(filters),
  });
};

export default useFindings;
