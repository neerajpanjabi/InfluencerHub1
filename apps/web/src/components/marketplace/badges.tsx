import { useTranslations } from 'next-intl';
import { BadgeCheck, FlaskConical, ShieldCheck, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';

const GRADE_STYLE: Record<string, string> = {
  S: 'bg-navy-900 text-gold-400 border-gold-500',
  A: 'bg-navy-800 text-ivory border-navy-800',
  B: 'bg-white text-navy-900 border-navy-700',
  C: 'bg-white text-stone-700 border-stone-400',
  D: 'bg-white text-stone-500 border-stone-300',
  NOT_RATED: 'bg-stone-50 text-stone-500 border-stone-200',
};

export function GradeBadge({ grade, score, size = 'md' }: { grade: string; score?: string | number | null; size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('enums.grade');
  const rated = grade !== 'NOT_RATED';
  const dims = size === 'lg' ? 'h-14 min-w-14 text-2xl' : size === 'sm' ? 'h-7 min-w-7 text-sm' : 'h-9 min-w-9 text-base';
  return (
    <span className="inline-flex items-center gap-2" title={rated && score != null ? `${t(grade)} · ${Number(score).toFixed(1)}` : t(grade)}>
      <span className={cn('inline-flex items-center justify-center rounded border px-1.5 font-display', dims, GRADE_STYLE[grade] ?? GRADE_STYLE.NOT_RATED, !rated && 'text-xs font-sans px-2')}>{rated ? grade : t('NOT_RATED')}</span>
      {rated && score != null && size !== 'sm' && <span className="text-xs text-stone-500">{Number(score).toFixed(1)}</span>}
    </span>
  );
}

export function VerifiedBadges({ identity, medical, isMedical, sandbox, compact }: { identity?: string; medical?: string; isMedical?: boolean; sandbox?: boolean; compact?: boolean }) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {identity === 'VERIFIED' && (
        <span className="inline-flex items-center gap-1 text-xs text-navy-700" title={t('profile.verifiedIdentity')}>
          <BadgeCheck className="h-4 w-4 text-gold-600" />
          {!compact && t('profile.verifiedIdentity')}
        </span>
      )}
      {isMedical && medical === 'VERIFIED' && (
        <span className="inline-flex items-center gap-1 text-xs text-navy-700" title={t('profile.medicalVerified')}>
          <Stethoscope className="h-4 w-4 text-gold-600" />
          {!compact && t('profile.medicalVerified')}
        </span>
      )}
      {sandbox && (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800" title={t('common.sandboxDataHint')}>
          <FlaskConical className="h-3 w-3" />
          {t('common.sandboxData')}
        </span>
      )}
    </div>
  );
}

export function VerificationPill({ status, source }: { status: string; source?: string }) {
  const t = useTranslations('enums');
  const ok = status === 'API_VERIFIED';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', ok ? 'text-success' : status === 'MANUALLY_SUBMITTED' || status === 'PENDING_VERIFICATION' ? 'text-warning' : 'text-stone-500')}>
      {ok && <ShieldCheck className="h-3 w-3" />}
      {t(`verification.${status}` as any)}
      {source && <span className="text-stone-400">· {t(`source.${source}` as any)}</span>}
    </span>
  );
}
