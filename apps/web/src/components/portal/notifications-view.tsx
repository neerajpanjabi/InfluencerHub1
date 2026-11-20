'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { fmtRelative } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function NotificationsView() {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: any[]; unread: number }>('/notifications') });
  const markAll = async () => {
    await api('/notifications/read', { body: { ids: 'all' } });
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['unread'] });
  };
  return (
    <div className="max-w-3xl">
      <PageHeader title={t('notifications.title')} actions={data?.unread ? <Button variant="outline" size="sm" onClick={markAll}>{t('notifications.markAllRead')}</Button> : null} />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data?.items.length ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title={t('notifications.empty')} />
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
          {data.items.map((n) => {
            const params = (n.params ?? {}) as Record<string, string>;
            const title = t.has(`notifications.${n.type}.title`) ? t(`notifications.${n.type}.title` as any, params) : n.type;
            const body = t.has(`notifications.${n.type}.body`) ? t(`notifications.${n.type}.body` as any, params) : '';
            const inner = (
              <div className={cn('flex gap-3 px-5 py-4', !n.readAt && 'bg-gold-100/30')}>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-gold-500')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy-900">{title}</p>
                  {body && <p className="truncate text-sm text-stone-500">{body}</p>}
                </div>
                <span className="shrink-0 text-xs text-stone-400">{fmtRelative(n.createdAt, locale)}</span>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link.split('?')[0] + (n.link.includes('?') ? '?' + n.link.split('?')[1] : '')}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
