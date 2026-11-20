'use client';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/misc';
import { CreatorProfileForm } from '@/components/portal/creator-profile-form';
export default function Page() {
  const t = useTranslations();
  return (
    <div className="max-w-3xl">
      <PageHeader title={t('influencer.profile.title')} />
      <CreatorProfileForm />
    </div>
  );
}
