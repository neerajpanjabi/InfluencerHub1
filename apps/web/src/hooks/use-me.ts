'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';

export interface Me {
  id: string;
  email: string;
  type: 'BUSINESS' | 'INFLUENCER' | 'ADMIN';
  locale: 'en' | 'ar';
  roles: string[];
  emailVerifiedAt: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  twoFactorEnabled: boolean;
  twoFactorPassed?: boolean;
  businessProfile: { id: string; businessName: string; logoUrl: string | null; onboardingCompleted: boolean; verificationStatus: string } | null;
  influencerProfile: { id: string; slug: string; displayName: string; profileImageUrl: string | null; onboardingCompleted: boolean; isPublic: boolean; currentGrade: string } | null;
}

export function useMe() {
  const hasSession = typeof document !== 'undefined' && document.cookie.includes('ih_csrf=');
  return useQuery<Me | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<Me>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
        throw e;
      }
    },
    enabled: hasSession,
    initialData: hasSession ? undefined : null,
    staleTime: 60_000,
  });
}

export function useInvalidateMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['me'] });
}
