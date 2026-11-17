'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadFile } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Field, Input, Select } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export default function Verification() {
  const t = useTranslations();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const { data: p } = useQuery({ queryKey: ['inf-profile'], queryFn: () => api<any>('/influencers/me/profile') });
  const [idDocs, setIdDocs] = useState<string[]>([]);
  const [med, setMed] = useState({ profession: '', speciality: '', licensingAuthority: 'DHA', licenceNumber: '', licenceExpiry: '', documentId: '' });
  const [permit, setPermit] = useState({ advertiserPermitNumber: '', advertiserPermitExpiry: '' });
  if (!p) return <Skeleton className="h-64" />;
  const vs = (s: string) => <StatusBadge status={s} label={t(`enums.verificationStatus.${s}` as any)} />;
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ['inf-profile'] });
      toast(t('influencer.verification.submitted'));
    } catch (e) {
      toast(err(e), 'error');
    }
  };
  const up = async (file: File | undefined, cb: (id: string) => void) => {
    if (!file) return;
    try { cb((await uploadFile(file, 'VERIFICATION')).id); } catch (e) { toast(err(e), 'error'); }
  };
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('influencer.verification.title')} />
      <Card>
        <CardHeader title={t('influencer.verification.identity')} description={t('influencer.verification.identityBody')} action={vs(p.identityStatus)} />
        {!['VERIFIED', 'PENDING'].includes(p.identityStatus) && (
          <CardBody className="flex flex-wrap items-center gap-3">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => up(e.target.files?.[0], (id) => setIdDocs([...idDocs, id]))} />
            <Button disabled={!idDocs.length} onClick={() => run(() => api('/influencers/me/verification/identity', { body: { documentIds: idDocs } }))}>{t('influencer.verification.submit')}</Button>
          </CardBody>
        )}
      </Card>
      <Card>
        <CardHeader title={t('influencer.verification.medical')} description={t('influencer.verification.medicalBody')} action={p.isMedicalProfessional ? vs(p.medicalStatus) : undefined} />
        <CardBody>
          {p.medicalCredentials?.map((c: any) => <p key={c.id} className="mb-2 text-sm">{c.profession} · {c.licensingAuthority} {c.licenceNumber} {vs(c.status)}</p>)}
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void run(() => api('/influencers/me/medical-credentials', { body: { ...med, speciality: med.speciality || undefined, licenceExpiry: med.licenceExpiry || undefined, documentId: med.documentId || undefined } })); }}>
            <Field label={t('influencer.verification.profession')}><Input required value={med.profession} onChange={(e) => setMed({ ...med, profession: e.target.value })} /></Field>
            <Field label={t('influencer.verification.speciality')}><Input value={med.speciality} onChange={(e) => setMed({ ...med, speciality: e.target.value })} /></Field>
            <Field label={t('influencer.verification.authority')}><Select value={med.licensingAuthority} onChange={(e) => setMed({ ...med, licensingAuthority: e.target.value })}>{['DHA', 'DOH', 'MOHAP', 'OTHER'].map((a) => <option key={a}>{a}</option>)}</Select></Field>
            <Field label={t('influencer.verification.licenceNumber')}><Input required value={med.licenceNumber} onChange={(e) => setMed({ ...med, licenceNumber: e.target.value })} /></Field>
            <Field label={t('influencer.verification.licenceExpiry')}><Input type="date" value={med.licenceExpiry} onChange={(e) => setMed({ ...med, licenceExpiry: e.target.value })} /></Field>
            <Field label={t('influencer.verification.document')}><input type="file" accept="image/*,application/pdf" onChange={(e) => up(e.target.files?.[0], (id) => setMed({ ...med, documentId: id }))} /></Field>
            <div><Button type="submit">{t('influencer.verification.submit')}</Button></div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('influencer.verification.permit')} description={t('influencer.verification.permitBody')} action={vs(p.advertiserPermitStatus)} />
        <CardBody>
          <form className="grid gap-3 sm:grid-cols-3 sm:items-end" onSubmit={(e) => { e.preventDefault(); void run(() => api('/influencers/me/profile', { method: 'PATCH', body: { advertiserPermitNumber: permit.advertiserPermitNumber, advertiserPermitExpiry: permit.advertiserPermitExpiry || null } })); }}>
            <Field label={t('influencer.verification.permitNumber')}><Input required defaultValue={p.advertiserPermitNumber ?? ''} onChange={(e) => setPermit({ ...permit, advertiserPermitNumber: e.target.value })} /></Field>
            <Field label={t('influencer.verification.permitExpiry')}><Input type="date" onChange={(e) => setPermit({ ...permit, advertiserPermitExpiry: e.target.value })} /></Field>
            <Button type="submit">{t('influencer.verification.submit')}</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
