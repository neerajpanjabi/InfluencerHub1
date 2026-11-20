'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Checkbox, Field, Input, Select } from '@/components/ui/input';
import { Dialog, PageHeader } from '@/components/ui/misc';
import { useAdminAction } from '@/components/portal/admin-kit';

export default function Categories() {
  const t = useTranslations();
  const { data, refetch } = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api<any[]>('/categories') });
  const act = useAdminAction();
  const [edit, setEdit] = useState<any>(null);
  const roots = data ?? [];
  return (
    <div>
      <PageHeader title={t('admin.nav.categories')} actions={<Button onClick={() => setEdit({ slug: '', nameEn: '', nameAr: '', parentId: null, isActive: true })}>{t('common.add')}</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {roots.map((c) => (
          <Card key={c.id}>
            <CardBody>
              <div className="flex items-center justify-between">
                <p className="font-medium">{c.nameEn} · <span dir="rtl">{c.nameAr}</span> {c.requiresMedicalCompliance && <Badge tone="warning">medical</Badge>} {c.commissionRate && <Badge tone="gold">{Number(c.commissionRate)}%</Badge>}</p>
                <Button size="sm" variant="ghost" onClick={() => setEdit({ ...c, children: undefined, influencerCount: undefined, commissionRate: c.commissionRate ? Number(c.commissionRate) : null })}>{t('common.edit')}</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.children.map((ch: any) => <button key={ch.id} onClick={() => setEdit({ ...ch, influencerCount: undefined, commissionRate: ch.commissionRate ? Number(ch.commissionRate) : null })} className="rounded bg-stone-100 px-2 py-0.5 text-xs hover:bg-gold-100">{ch.nameEn}</button>)}
                <button onClick={() => setEdit({ slug: '', nameEn: '', nameAr: '', parentId: c.id, isActive: true })} className="rounded border border-dashed border-stone-300 px-2 py-0.5 text-xs">+</button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={t('admin.nav.categories')}>
        {edit && (
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const { createdAt, updatedAt, ...body } = edit; void createdAt; void updatedAt; await act(() => api('/admin/categories', { method: 'PUT', body })); setEdit(null); refetch(); }}>
            <Field label="Slug"><Input dir="ltr" required pattern="[a-z0-9-]{2,60}" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></Field>
            <Field label="Name (EN)"><Input required value={edit.nameEn} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></Field>
            <Field label="الاسم (AR)"><Input dir="rtl" required value={edit.nameAr} onChange={(e) => setEdit({ ...edit, nameAr: e.target.value })} /></Field>
            <Field label="Parent"><Select value={edit.parentId ?? ''} onChange={(e) => setEdit({ ...edit, parentId: e.target.value || null })}><option value="">—</option>{roots.map((r) => <option key={r.id} value={r.id}>{r.nameEn}</option>)}</Select></Field>
            <Field label={t('admin.commissionRate')}><Input type="number" min={0} max={50} step="0.1" value={edit.commissionRate ?? ''} onChange={(e) => setEdit({ ...edit, commissionRate: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <Checkbox label="Active" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />
            <Checkbox label="Requires medical compliance" checked={!!edit.requiresMedicalCompliance} onChange={(e) => setEdit({ ...edit, requiresMedicalCompliance: e.target.checked })} />
            <Button type="submit" className="w-full">{t('common.save')}</Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
