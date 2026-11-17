'use client';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { Instagram, Music2 } from '@/components/ui/platform-icons';
import { Link } from '@/i18n/routing';
import { Avatar } from '@/components/ui/misc';
import { fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';
import { GradeBadge, VerifiedBadges } from './badges';

export interface CreatorCardData {
  id: string;
  slug: string;
  displayName: string;
  displayNameAr?: string | null;
  profileImageUrl?: string | null;
  emirate?: string | null;
  city?: string | null;
  currentGrade: string;
  currentScore?: string | null;
  totalFollowers: number;
  avgReelViews?: number | null;
  avgVideoViews?: number | null;
  engagementRate?: string | null;
  startingPrice?: string | null;
  identityStatus?: string;
  medicalStatus?: string;
  isMedicalProfessional?: boolean;
  hasSandboxData?: boolean;
  categories: Array<{ isPrimary: boolean; category: { slug: string; nameEn: string; nameAr: string; parentId: string | null } }>;
  socialAccounts: Array<{ platform: string; username: string }>;
}

export function CreatorCard({ c }: { c: CreatorCardData }) {
  const locale = useLocale();
  const t = useTranslations();
  const name = locale === 'ar' && c.displayNameAr ? c.displayNameAr : c.displayName;
  const cats = [...c.categories].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).slice(0, 2);
  const views = c.avgReelViews ?? c.avgVideoViews;
  return (
    <Link href={`/creators/${c.slug}`} className="group flex flex-col rounded-lg border border-stone-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-lift">
      <div className="flex items-start gap-3">
        <Avatar name={c.displayName} src={c.profileImageUrl} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg text-navy-900 group-hover:text-navy-700">{name}</p>
          {c.emirate && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
              <MapPin className="h-3 w-3" />
              {t(`enums.emirate.${c.emirate}` as any)}
            </p>
          )}
        </div>
        <GradeBadge grade={c.currentGrade} size="sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {cats.map((x) => (
          <span key={x.category.slug} className="rounded bg-ivory-100 px-2 py-0.5 text-xs text-navy-800">
            {locale === 'ar' ? x.category.nameAr : x.category.nameEn}
          </span>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-center">
        <div>
          <dt className="text-[11px] text-stone-500">{t('common.followers')}</dt>
          <dd className="font-medium">{fmtNumber(c.totalFollowers, locale)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-stone-500">{t('enums.metric.AVG_REEL_VIEWS')}</dt>
          <dd className="font-medium">{fmtNumber(views, locale)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-stone-500">{t('search.engagementShort')}</dt>
          <dd className="font-medium">{fmtPercent(c.engagementRate, locale)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-stone-500">
          {c.socialAccounts.some((s) => s.platform === 'INSTAGRAM') && <Instagram className="h-4 w-4" aria-label="Instagram" />}
          {c.socialAccounts.some((s) => s.platform === 'TIKTOK') && <Music2 className="h-4 w-4" aria-label="TikTok" />}
          <VerifiedBadges identity={c.identityStatus} medical={c.medicalStatus} isMedical={c.isMedicalProfessional} sandbox={c.hasSandboxData} compact />
        </div>
        {c.startingPrice && (
          <p className="text-sm">
            <span className="text-stone-500">{t('search.startingFrom')} </span>
            <span className="font-semibold text-navy-900">{fmtMoney(c.startingPrice, locale)}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
