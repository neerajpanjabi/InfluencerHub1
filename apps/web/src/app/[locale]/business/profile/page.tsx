'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EMIRATES } from '@influencehub/shared';
import { api, uploadFile } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { useInvalidateMe } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Avatar, PageHeader, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export default function BusinessProfile() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const invalidate = useInvalidateMe();
  const { data: b } = useQuery({ queryKey: ['business-me'], queryFn: () => api<any>('/businesses/me') });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/categories') });
  const [f, setF] = useState<Record<string, any>>({});
  const [docs, setDocs] = useState<string[]>([]);
  useEffect(() => {
    if (b) setF({ businessName: b.businessName, contactPerson: b.contactPerson, phone: b.phone ?? '', emirate: b.emirate ?? 'DUBAI', city: b.city ?? '', website: b.website ?? '', description: b.description ?? '', tradeLicenceNumber: b.tradeLicenceNumber ?? '', tradeLicenceAuthority: b.tradeLicenceAuthority ?? '', trnNumber: b.trnNumber ?? '', categoryId: b.categories[0]?.categoryId ?? '' });
  }, [b]);
  if (!b) return <Skeleton className="h-64" />;
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('business.profile.title')} />
      <Card>
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const { categoryId, ...rest } = f;
                await api('/businesses/me', { method: 'PATCH', body: { ...rest, phone: rest.phone || undefined, categoryIds: categoryId ? [categoryId] : undefined } });
                qc.invalidateQueries({ queryKey: ['business-me'] });
                invalidate();
                toast(t('common.saved'));
              } catch (e2) {
                toast(err(e2), 'error');
              }
            }}
          >
            <div className="flex items-center gap-4 sm:col-span-2">
              <Avatar name={b.businessName} src={b.logoUrl} size={64} />
              <label className="cursor-pointer text-sm underline">
                {t('business.profile.logo')}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { await uploadFile(e.target.files[0], 'LOGO').catch((x) => toast(err(x), 'error')); qc.invalidateQueries({ queryKey: ['business-me'] }); invalidate(); } }} />
              </label>
            </div>
            <Field label={t('auth.businessName')}><Input value={f.businessName ?? ''} onChange={set('businessName')} /></Field>
            <Field label={t('auth.contactPerson')}><Input value={f.contactPerson ?? ''} onChange={set('contactPerson')} /></Field>
            <Field label={t('auth.phone')}><Input dir="ltr" value={f.phone ?? ''} onChange={set('phone')} /></Field>
            <Field label={t('auth.category')}>
              <Select value={f.categoryId ?? ''} onChange={set('categoryId')}>
                {cats.data?.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</option>)}
              </Select>
            </Field>
            <Field label={t('auth.emirate')}>
              <Select value={f.emirate ?? ''} onChange={set('emirate')}>{EMIRATES.map((x) => <option key={x} value={x}>{t(`enums.emirate.${x}`)}</option>)}</Select>
            </Field>
            <Field label={t('auth.city')}><Input value={f.city ?? ''} onChange={set('city')} /></Field>
            <Field label={t('auth.website')}><Input dir="ltr" type="url" value={f.website ?? ''} onChange={set('website')} /></Field>
            <Field label={t('business.profile.trn')}><Input dir="ltr" value={f.trnNumber ?? ''} onChange={set('trnNumber')} maxLength={15} /></Field>
            <Field label={t('auth.tradeLicence')}><Input value={f.tradeLicenceNumber ?? ''} onChange={set('tradeLicenceNumber')} /></Field>
            <Field label={t('business.profile.licenceAuthority')}><Input value={f.tradeLicenceAuthority ?? ''} onChange={set('tradeLicenceAuthority')} /></Field>
            <div className="sm:col-span-2"><Field label={t('auth.description')}><Textarea value={f.description ?? ''} onChange={set('description')} /></Field></div>
            <div><Button type="submit">{t('common.save')}</Button></div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('business.profile.verification')} description={t('business.profile.verificationBody')} action={<StatusBadge status={b.verificationStatus} label={t(`enums.verificationStatus.${b.verificationStatus}` as any)} />} />
        {b.verificationStatus !== 'VERIFIED' && b.verificationStatus !== 'PENDING' && (
          <CardBody className="flex flex-wrap items-center gap-3">
            <input type="file" accept="application/pdf,image/*" onChange={async (e) => { if (e.target.files?.[0]) { try { const a = await uploadFile(e.target.files[0], 'VERIFICATION'); setDocs([...docs, a.id]); } catch (x) { toast(err(x), 'error'); } } }} />
            <Button disabled={!docs.length} onClick={async () => { await api('/businesses/me/verification', { body: { documentIds: docs } }); qc.invalidateQueries({ queryKey: ['business-me'] }); toast(t('influencer.verification.submitted')); }}>
              {t('business.profile.requestVerification')}
            </Button>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
