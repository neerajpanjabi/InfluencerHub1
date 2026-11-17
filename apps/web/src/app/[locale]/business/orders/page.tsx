'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState, PageHeader, Skeleton, Table, Td } from '@/components/ui/misc';

export default function Orders() {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => api<any[]>('/orders') });
  return (
    <div>
      <PageHeader title={t('business.orders.title')} />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data?.length ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title={t('business.orders.empty')} />
      ) : (
        <Table head={[t('business.orders.order'), t('common.date'), t('business.orders.items'), t('common.status'), t('common.total')]}>
          {data.map((o) => (
            <tr key={o.id} className="hover:bg-stone-50">
              <Td>
                <Link href={`/business/orders/${o.id}`} className="font-medium hover:underline">
                  {o.number}
                </Link>
              </Td>
              <Td className="whitespace-nowrap">{fmtDate(o.createdAt, locale)}</Td>
              <Td>{o.items.map((i: any) => `${i.description} — ${i.influencer.displayName}`).join(', ')}</Td>
              <Td>
                <StatusBadge status={o.status} label={t(`enums.orderStatus.${o.status}` as any)} />
              </Td>
              <Td className="whitespace-nowrap font-medium">{fmtMoney(o.grandTotal, locale, { decimals: true })}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
