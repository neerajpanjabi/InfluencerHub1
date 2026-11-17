'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { PageHeader } from '@/components/ui/misc';
import { CreatorProfileForm } from '@/components/portal/creator-profile-form';
export default function Page() {
  const t = useTranslations();
  const router = useRouter();
  return (
    <div className="max-w-3xl">
      <PageHeader title={t('influencer.profile.onboardingTitle')} description={t('influencer.overview.connectHint')} />
      <CreatorProfileForm onSaved={() => router.push('/influencer/accounts')} />
    </div>
  );
}
