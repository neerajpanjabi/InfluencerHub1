'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Select } from '@/components/ui/input';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Fees() {
  const t = useTranslations('admin');
  const contact = useAdmin<any>('/settings/contact');
  const commission = useAdmin<any>('/settings/commission');
  const vat = useAdmin<any>('/settings/vat');
  const act = useAdminAction();
  const [c, setC] = useState<any>(null);
  const [k, setK] = useState<any>(null);
  const [v, setV] = useState<any>(null);
  useEffect(() => { if (contact.data) setC(contact.data); }, [contact.data]);
  useEffect(() => { if (commission.data) setK(commission.data); }, [commission.data]);
  useEffect(() => { if (vat.data) setV(vat.data); }, [vat.data]);
  if (!c || !k || !v) return <Skeleton className="h-64" />;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('nav.fees')} />
      <Card>
        <CardHeader title={t('contactFee')} />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label={t('contactFee')}><Input value={c.contactFee} onChange={(e) => setC({ ...c, contactFee: e.target.value })} /></Field>
          <Field label={t('freeAllowance')}><Input type="number" min={0} value={c.freeContactAllowance} onChange={(e) => setC({ ...c, freeContactAllowance: Number(e.target.value) })} /></Field>
          <Field label={t('accessDays')}><Input type="number" min={1} value={c.accessDurationDays ?? ''} onChange={(e) => setC({ ...c, accessDurationDays: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label={t('maxPerDay')}><Input type="number" min={1} value={c.maxContactsPerDay} onChange={(e) => setC({ ...c, maxContactsPerDay: Number(e.target.value) })} /></Field>
          <Field label={t('refundPolicy')}><Select value={c.refundPolicy} onChange={(e) => setC({ ...c, refundPolicy: e.target.value })}>{['NON_REFUNDABLE', 'REFUNDABLE_IF_NO_REPLY_7_DAYS', 'MANUAL_REVIEW'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <div className="sm:col-span-2"><Button onClick={() => act(() => api('/admin/settings/contact', { method: 'PATCH', body: { contactFee: c.contactFee, freeContactAllowance: c.freeContactAllowance, accessDurationDays: c.accessDurationDays, maxContactsPerDay: c.maxContactsPerDay, refundPolicy: c.refundPolicy } }))}>{t('saveSettings')}</Button></div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('commissionRate')} />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label={t('commissionRate')}><Input type="number" step="0.1" min={0} max={50} value={k.defaultRate} onChange={(e) => setK({ ...k, defaultRate: Number(e.target.value) })} /></Field>
          <Field label={t('commissionPayer')}><Select value={k.payer} onChange={(e) => setK({ ...k, payer: e.target.value })}>{['INFLUENCER', 'BUSINESS', 'SPLIT'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label={t('splitShare')}><Input type="number" min={0} max={100} value={k.splitBusinessShare} onChange={(e) => setK({ ...k, splitBusinessShare: Number(e.target.value) })} /></Field>
          <div />
          <Field label={t('minCommission')}><Input value={k.minCommission ?? ''} onChange={(e) => setK({ ...k, minCommission: e.target.value || null })} /></Field>
          <Field label={t('maxCommission')}><Input value={k.maxCommission ?? ''} onChange={(e) => setK({ ...k, maxCommission: e.target.value || null })} /></Field>
          <p className="text-xs text-stone-500 sm:col-span-2">Category- and service-specific rates are set in Categories and Service catalogue.</p>
          <div className="sm:col-span-2"><Button onClick={() => act(() => api('/admin/settings/commission', { method: 'PATCH', body: { defaultRate: k.defaultRate, payer: k.payer, splitBusinessShare: k.splitBusinessShare, minCommission: k.minCommission, maxCommission: k.maxCommission } }))}>{t('saveSettings')}</Button></div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="VAT" description="Confirm treatment with a UAE tax adviser before go-live." />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Field label={t('vatRate')}><Input type="number" step="0.1" value={v.standardRate} onChange={(e) => setV({ ...v, standardRate: Number(e.target.value) })} /></Field>
          <div className="pt-7"><Checkbox label={t('vatRegistered')} checked={v.platformVatRegistered} onChange={(e) => setV({ ...v, platformVatRegistered: e.target.checked })} /></div>
          <div><Button onClick={() => act(() => api('/admin/settings/vat', { method: 'PATCH', body: v }))}>{t('saveSettings')}</Button></div>
        </CardBody>
      </Card>
    </div>
  );
}
