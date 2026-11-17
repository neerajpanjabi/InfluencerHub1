'use client';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader, Table, Td } from '@/components/ui/misc';
import { useAdminAction } from '@/components/portal/admin-kit';

export default function Catalog() {
  const t = useTranslations();
  const { data, refetch } = useQuery({ queryKey: ['admin', 'catalog'], queryFn: () => api<any[]>('/services/catalog') });
  const act = useAdminAction();
  const save = (c: any, patch: any) => act(() => api('/admin/catalog', { method: 'PUT', body: { id: c.id, key: c.key, platform: c.platform, nameEn: c.nameEn, nameAr: c.nameAr, complexityFactor: Number(c.complexityFactor), isActive: c.isActive, commissionRate: c.commissionRate ? Number(c.commissionRate) : null, ...patch } })).then(() => refetch());
  return (
    <div>
      <PageHeader title={t('admin.nav.catalog')} />
      <Table head={['Key', 'Name', 'Platform', 'Complexity', t('admin.commissionRate'), t('common.status')]}>
        {data?.map((c) => (
          <tr key={c.id}>
            <Td className="text-xs" dir="ltr">{c.key}</Td>
            <Td>{c.nameEn}<div className="text-xs text-stone-500" dir="rtl">{c.nameAr}</div></Td>
            <Td className="text-xs">{c.platform}</Td>
            <Td><Input className="h-8 w-20" type="number" step="0.05" defaultValue={Number(c.complexityFactor)} onBlur={(e) => Number(e.target.value) !== Number(c.complexityFactor) && save(c, { complexityFactor: Number(e.target.value) })} /></Td>
            <Td><Input className="h-8 w-20" type="number" step="0.5" placeholder="default" defaultValue={c.commissionRate ?? ''} onBlur={(e) => save(c, { commissionRate: e.target.value === '' ? null : Number(e.target.value) })} /></Td>
            <Td><Button size="sm" variant="outline" onClick={() => save(c, { isActive: !c.isActive })}>{c.isActive ? 'Active' : 'Inactive'}</Button></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
