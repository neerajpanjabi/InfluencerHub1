'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { EMIRATES } from '@influencehub/shared';
import { api } from '@/lib/api';
import { fmtMoney, fmtNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox, Field, Input, Select } from '@/components/ui/input';
import { Alert, Dialog, PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdmin, useAdminAction } from '@/components/portal/admin-kit';

export default function Benchmarks() {
  const t = useTranslations();
  const locale = useLocale();
  const { data } = useAdmin<any[]>('/benchmarks');
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<any[]>('/services/catalog') });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/categories') });
  const act = useAdminAction();
  const [edit, setEdit] = useState<any>(null);
  const blank = { platform: 'INSTAGRAM', catalogId: null, categoryId: null, emirate: null, grade: null, followersMin: null, followersMax: null, minRate: '', medianRate: '', maxRate: '', isSample: false, researchSource: '', researchedAt: '' };
  const num = (v: any) => (v === '' || v == null ? null : Number(v));
  return (
    <div>
      <PageHeader title={t('admin.nav.benchmarks')} actions={<Button onClick={() => setEdit(blank)}>{t('common.add')}</Button>} />
      <Alert tone="warning" className="mb-4">{t('influencer.services.sampleWarning')} — there is no single official UAE influencer price list.</Alert>
      <Table head={['Platform', 'Service', 'Category / emirate / grade', t('common.followers'), 'Min / Median / Max', 'Source', '']}>
        {data?.map((b) => (
          <tr key={b.id}>
            <Td className="text-xs">{b.platform}</Td>
            <Td className="text-xs">{b.catalog?.nameEn ?? '—'}</Td>
            <Td className="text-xs">{b.category?.nameEn ?? '—'} / {b.emirate ?? '—'} / {b.grade ?? '—'}</Td>
            <Td className="whitespace-nowrap text-xs">{fmtNumber(b.followersMin, locale)}–{b.followersMax ? fmtNumber(b.followersMax, locale) : '∞'}</Td>
            <Td className="whitespace-nowrap">{fmtMoney(b.minRate, locale)} / <strong>{fmtMoney(b.medianRate, locale)}</strong> / {fmtMoney(b.maxRate, locale)}</Td>
            <Td className="max-w-[220px] text-xs">{b.isSample ? <Badge tone="warning">{t('admin.sample')}</Badge> : <Badge tone="success">{t('admin.researched')}</Badge>} {b.researchSource}</Td>
            <Td className="whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => setEdit({ ...b, minRate: Number(b.minRate), medianRate: Number(b.medianRate), maxRate: Number(b.maxRate), researchedAt: b.researchedAt?.slice(0, 10) ?? '' })}>{t('common.edit')}</Button><Button size="sm" variant="ghost" onClick={() => confirm('Delete?') && act(() => api(`/admin/benchmarks/${b.id}`, { method: 'DELETE' }))}>{t('common.delete')}</Button></Td>
          </tr>
        ))}
      </Table>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={t('admin.nav.benchmarks')} wide>
        {edit && (
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); const r = await act(() => api('/admin/benchmarks', { method: 'PUT', body: { id: edit.id, platform: edit.platform, catalogId: edit.catalogId || null, categoryId: edit.categoryId || null, emirate: edit.emirate || null, grade: edit.grade || null, followersMin: num(edit.followersMin), followersMax: num(edit.followersMax), minRate: Number(edit.minRate), medianRate: Number(edit.medianRate), maxRate: Number(edit.maxRate), isSample: edit.isSample, researchSource: edit.researchSource, researchedAt: edit.researchedAt || null } })); if (r) setEdit(null); }}>
            <Field label="Platform"><Select value={edit.platform} onChange={(e) => setEdit({ ...edit, platform: e.target.value })}>{['INSTAGRAM', 'TIKTOK', 'CROSS_PLATFORM', 'OFFLINE'].map((p) => <option key={p}>{p}</option>)}</Select></Field>
            <Field label="Service"><Select value={edit.catalogId ?? ''} onChange={(e) => setEdit({ ...edit, catalogId: e.target.value })}><option value="">—</option>{catalog.data?.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}</Select></Field>
            <Field label="Category"><Select value={edit.categoryId ?? ''} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}><option value="">—</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}</Select></Field>
            <Field label="Emirate"><Select value={edit.emirate ?? ''} onChange={(e) => setEdit({ ...edit, emirate: e.target.value })}><option value="">—</option>{EMIRATES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Grade"><Select value={edit.grade ?? ''} onChange={(e) => setEdit({ ...edit, grade: e.target.value })}><option value="">—</option>{['S', 'A', 'B', 'C', 'D'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <div />
            <Field label="Followers min"><Input type="number" value={edit.followersMin ?? ''} onChange={(e) => setEdit({ ...edit, followersMin: e.target.value })} /></Field>
            <Field label="Followers max"><Input type="number" value={edit.followersMax ?? ''} onChange={(e) => setEdit({ ...edit, followersMax: e.target.value })} /></Field>
            <div />
            <Field label="Min (AED)"><Input type="number" required value={edit.minRate} onChange={(e) => setEdit({ ...edit, minRate: e.target.value })} /></Field>
            <Field label="Median (AED)"><Input type="number" required value={edit.medianRate} onChange={(e) => setEdit({ ...edit, medianRate: e.target.value })} /></Field>
            <Field label="Max (AED)"><Input type="number" required value={edit.maxRate} onChange={(e) => setEdit({ ...edit, maxRate: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Research source"><Input required value={edit.researchSource} onChange={(e) => setEdit({ ...edit, researchSource: e.target.value })} /></Field></div>
            <Field label="Date researched"><Input type="date" value={edit.researchedAt} onChange={(e) => setEdit({ ...edit, researchedAt: e.target.value })} /></Field>
            <Checkbox label={t('admin.sample')} checked={edit.isSample} onChange={(e) => setEdit({ ...edit, isSample: e.target.checked })} />
            <div className="sm:col-span-3"><Button type="submit" className="w-full">{t('common.save')}</Button></div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
