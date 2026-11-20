'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { useToast } from '@/components/ui/toast';

export function useAdmin<T = any>(path: string, key?: unknown[]) {
  return useQuery<T>({ queryKey: key ?? ['admin', path], queryFn: () => api<T>(`/admin${path}`) });
}

/** Wraps admin mutations with toast + cache refresh. */
export function useAdminAction() {
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  return async (fn: () => Promise<unknown>, okMsg = '✓') => {
    try {
      const r = await fn();
      toast(okMsg);
      qc.invalidateQueries({ queryKey: ['admin'] });
      return r;
    } catch (e) {
      toast(err(e), 'error');
      return undefined;
    }
  };
}
