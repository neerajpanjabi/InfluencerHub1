'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Megaphone, Star } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Alert, Dialog, EmptyState, PageHeader, Skeleton, Table, Td } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export function CampaignsList({ base }: { base: '/business' | '/influencer' }) {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: () => api<any[]>('/campaigns') });
  return (
    <div>
      <PageHeader title={base === '/business' ? t('business.nav.campaigns') : t('influencer.nav.campaigns')} />
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !data?.length ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title={t('campaign.empty')} action={base === '/business' ? <Link href="/creators" className="underline">{t('nav.browse')}</Link> : undefined} />
      ) : (
        <Table head={['#', t('campaign.title'), base === '/business' ? t('enums.userType.INFLUENCER') : t('enums.userType.BUSINESS'), t('common.status'), t('campaign.deadline'), t('campaign.agreedAmount')]}>
          {data.map((c) => (
            <tr key={c.id} className="hover:bg-stone-50">
              <Td className="whitespace-nowrap text-xs text-stone-500">{c.number}</Td>
              <Td>
                <Link href={`${base}/campaigns/${c.id}`} className="font-medium hover:underline">
                  {c.title}
                </Link>
              </Td>
              <Td>{base === '/business' ? c.influencer.displayName : c.business.businessName}</Td>
              <Td>
                <StatusBadge status={c.status} label={t(`enums.campaignStatus.${c.status}` as any)} />
              </Td>
              <Td className="whitespace-nowrap">{fmtDate(c.postingDeadline, locale)}</Td>
              <Td className="whitespace-nowrap">{fmtMoney(c.agreedAmount, locale)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

export function CampaignDetail({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const { data: c, isLoading } = useQuery({ queryKey: ['campaign', id], queryFn: () => api<any>(`/campaigns/${id}`) });
  const [dialog, setDialog] = useState<null | { kind: 'submit' | 'revision' | 'publish' | 'dispute' | 'brief'; did?: string }>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [rating, setRating] = useState(5);
  if (isLoading || !c) return <Skeleton className="h-96" />;
  const role: 'BUSINESS' | 'INFLUENCER' = c.viewerRole;
  const refresh = (data?: any) => {
    if (data) qc.setQueryData(['campaign', id], data);
    else qc.invalidateQueries({ queryKey: ['campaign', id] });
    qc.invalidateQueries({ queryKey: ['campaigns'] });
  };
  const act = async (fn: () => Promise<any>) => {
    try {
      const r = await fn();
      refresh(r?.viewerRole ? r : undefined);
      setDialog(null);
      setForm({});
    } catch (e) {
      toast(err(e), 'error');
    }
  };
  const transition = (to: string, note?: string) => act(() => api(`/campaigns/${id}/transition`, { body: { to, note } }));
  const can = (s: string) => c.allowedTransitions.includes(s);
  const otherName = role === 'BUSINESS' ? c.influencer.displayName : c.business.businessName;

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.title}
        description={`${c.number} · ${otherName}`}
        actions={
          <>
            <StatusBadge status={c.status} label={t(`enums.campaignStatus.${c.status}` as any)} />
            {c.complianceStatus !== 'NOT_REQUIRED' && <StatusBadge status={c.complianceStatus} label={t(`enums.complianceStatus.${c.complianceStatus}` as any)} />}
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        {role === 'INFLUENCER' && can('IN_PROGRESS') && <Button onClick={() => transition('IN_PROGRESS')}>{t('campaign.start')}</Button>}
        {role === 'BUSINESS' && can('COMPLETED') && <Button onClick={() => transition('COMPLETED')}>{t('campaign.complete')}</Button>}
        {role === 'BUSINESS' && ['DRAFT', 'ENQUIRY', 'PAYMENT_PENDING', 'CONFIRMED'].includes(c.status) && (
          <Button variant="outline" onClick={() => setDialog({ kind: 'brief' })}>
            {t('campaign.editBrief')}
          </Button>
        )}
        {can('DISPUTED') && (
          <Button variant="outline" onClick={() => setDialog({ kind: 'dispute' })}>
            {t('campaign.dispute')}
          </Button>
        )}
        {can('CANCELLED') && (
          <Button variant="ghost" onClick={() => confirm(t('campaign.cancel')) && transition('CANCELLED')}>
            {t('campaign.cancel')}
          </Button>
        )}
        {role === 'BUSINESS' && c.orderItem && (
          <Link href={`/business/orders/${c.orderItem.order.id}`} className="self-center text-sm underline">
            {t('business.orders.order')} {c.orderItem.order.number}
          </Link>
        )}
      </div>
      {c.complianceStatus === 'PENDING_REVIEW' && <Alert tone="warning">{t('errors.COMPLIANCE_REVIEW_PENDING')}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t('campaign.deliverables')} />
            <div className="divide-y divide-stone-100">
              {c.deliverables.map((d: any) => (
                <div key={d.id} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {d.quantity}× {d.type.replace(/_/g, ' ')}
                    </p>
                    <Badge tone="outline">{t(`enums.platform.${d.platform}` as any)}</Badge>
                    <StatusBadge status={d.status} label={t(`enums.deliverableStatus.${d.status}` as any)} />
                    <span className="text-xs text-stone-500">{t('campaign.revisionsUsed', { used: d.revisionCount, max: d.maxRevisions })}</span>
                    {d.dueAt && <span className="text-xs text-stone-500">· {fmtDate(d.dueAt, locale)}</span>}
                  </div>
                  {d.draftUrl && (
                    <a href={d.draftUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-sm text-navy-700 underline">
                      {t('campaign.draftUrl')} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {d.draftNotes && <p className="text-sm text-stone-600">{d.draftNotes}</p>}
                  {d.attachments?.map((a: any) => (
                    <a key={a.id} href={`/api/v1/uploads/${a.id}`} target="_blank" rel="noreferrer" className="block text-sm underline">
                      📎 {a.fileName}
                    </a>
                  ))}
                  {d.publishedUrl && (
                    <a href={d.publishedUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-sm text-success underline">
                      {t('campaign.evidence')} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {role === 'INFLUENCER' && ['PENDING', 'REVISION_REQUESTED'].includes(d.status) && ['IN_PROGRESS', 'REVISION_REQUESTED', 'CONTENT_SUBMITTED'].includes(c.status) && (
                      <Button size="sm" onClick={() => setDialog({ kind: 'submit', did: d.id })}>
                        {t('campaign.submitDraft')}
                      </Button>
                    )}
                    {role === 'BUSINESS' && d.status === 'SUBMITTED' && (
                      <>
                        <Button size="sm" onClick={() => act(() => api(`/campaigns/${id}/deliverables/${d.id}/review`, { body: { decision: 'APPROVED' } }))}>
                          {t('campaign.approve')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'revision', did: d.id })} disabled={d.revisionCount >= d.maxRevisions}>
                          {t('campaign.requestRevision')}
                        </Button>
                      </>
                    )}
                    {role === 'INFLUENCER' && (d.status === 'APPROVED' || (!c.requiresApproval && d.status === 'SUBMITTED')) && (
                      <Button size="sm" variant="gold" onClick={() => setDialog({ kind: 'publish', did: d.id })}>
                        {t('campaign.publish')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {c.approvals.length > 0 && (
            <Card>
              <CardHeader title={t('campaign.approve')} />
              <CardBody className="space-y-2">
                {c.approvals.map((a: any) => (
                  <p key={a.id} className="text-sm">
                    <StatusBadge status={a.decision} label={a.decision === 'APPROVED' ? t('campaign.approve') : t('campaign.requestRevision')} /> <span className="text-stone-500">{fmtDate(a.createdAt, locale, true)}</span> {a.comment && `— ${a.comment}`}
                  </p>
                ))}
              </CardBody>
            </Card>
          )}
          {role === 'BUSINESS' && c.status === 'COMPLETED' && c.reviews.length === 0 && (
            <Card>
              <CardHeader title={t('campaign.review')} />
              <CardBody className="space-y-3">
                <div className="flex gap-1" role="radiogroup" aria-label={t('campaign.rating')}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)}>
                      <Star className={`h-6 w-6 ${n <= rating ? 'fill-gold-500 text-gold-500' : 'text-stone-300'}`} />
                    </button>
                  ))}
                </div>
                <Textarea placeholder={t('campaign.comment')} value={form.comment ?? ''} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                <Button onClick={() => act(async () => { await api(`/campaigns/${id}/review`, { body: { rating, comment: form.comment || undefined } }); toast(t('campaign.reviewThanks')); })}>{t('common.submit')}</Button>
              </CardBody>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t('campaign.brief')} />
            <CardBody className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap text-stone-700">{c.brief || '—'}</p>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-stone-500">{t('campaign.agreedAmount')}</dt>
                  <dd className="font-medium">{fmtMoney(c.agreedAmount, locale)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-500">{t('campaign.deadline')}</dt>
                  <dd>{fmtDate(c.postingDeadline, locale)}</dd>
                </div>
                {c.requiredMentions?.length > 0 && (
                  <div>
                    <dt className="text-xs text-stone-500">{t('campaign.mentions')}</dt>
                    <dd dir="ltr">{c.requiredMentions.join(' ')}</dd>
                  </div>
                )}
                {c.requiredHashtags?.length > 0 && (
                  <div>
                    <dt className="text-xs text-stone-500">{t('campaign.hashtags')}</dt>
                    <dd dir="ltr">{c.requiredHashtags.join(' ')}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-stone-500">{t('campaign.approvalRequired')}</dt>
                  <dd>{c.requiresApproval ? t('common.yes') : t('common.no')}</dd>
                </div>
                {c.usageRights && (
                  <div className="col-span-2">
                    <dt className="text-xs text-stone-500">{t('campaign.usageRights')}</dt>
                    <dd>{c.usageRights}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('campaign.timeline')} />
            <CardBody>
              <ol className="space-y-3 border-s border-stone-200 ps-4">
                {c.events.map((e: any) => (
                  <li key={e.id} className="relative text-sm">
                    <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold-500" />
                    <p className="font-medium">{t(`enums.campaignStatus.${e.toStatus}` as any)}</p>
                    {e.note && <p className="text-stone-500">{e.note}</p>}
                    <p className="text-xs text-stone-400">{fmtDate(e.createdAt, locale, true)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog open={!!dialog} onClose={() => setDialog(null)} title={dialog?.kind === 'submit' ? t('campaign.submitDraft') : dialog?.kind === 'revision' ? t('campaign.requestRevision') : dialog?.kind === 'publish' ? t('campaign.publish') : dialog?.kind === 'brief' ? t('campaign.editBrief') : t('campaign.dispute')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const k = dialog?.kind;
            if (k === 'submit') void act(() => api(`/campaigns/${id}/deliverables/${dialog!.did}/submit`, { body: { draftUrl: form.draftUrl || undefined, draftNotes: form.draftNotes || undefined } }));
            if (k === 'revision') void act(() => api(`/campaigns/${id}/deliverables/${dialog!.did}/review`, { body: { decision: 'REVISION_REQUESTED', comment: form.comment } }));
            if (k === 'publish') void act(() => api(`/campaigns/${id}/deliverables/${dialog!.did}/publish`, { body: { publishedUrl: form.publishedUrl } }));
            if (k === 'dispute') void act(() => api(`/campaigns/${id}/dispute`, { body: { reason: form.reason, details: form.details } }));
            if (k === 'brief')
              void act(() =>
                api(`/campaigns/${id}/brief`, {
                  method: 'PATCH',
                  body: { brief: form.brief ?? c.brief ?? '', requiredMentions: (form.mentions ?? c.requiredMentions.join(' ')).split(/[\s,]+/).filter(Boolean), requiredHashtags: (form.hashtags ?? c.requiredHashtags.join(' ')).split(/[\s,]+/).filter(Boolean) },
                }),
              );
          }}
        >
          {dialog?.kind === 'submit' && (
            <>
              <Field label={t('campaign.draftUrl')}>
                <Input type="url" dir="ltr" value={form.draftUrl ?? ''} onChange={(e) => setForm({ ...form, draftUrl: e.target.value })} placeholder="https://" />
              </Field>
              <Field label={t('campaign.draftNotes')}>
                <Textarea value={form.draftNotes ?? ''} onChange={(e) => setForm({ ...form, draftNotes: e.target.value })} />
              </Field>
            </>
          )}
          {dialog?.kind === 'revision' && (
            <Field label={t('campaign.revisionComment')}>
              <Textarea required value={form.comment ?? ''} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </Field>
          )}
          {dialog?.kind === 'publish' && (
            <Field label={t('campaign.publishedUrl')}>
              <Input type="url" dir="ltr" required value={form.publishedUrl ?? ''} onChange={(e) => setForm({ ...form, publishedUrl: e.target.value })} placeholder="https://www.instagram.com/p/…" />
            </Field>
          )}
          {dialog?.kind === 'dispute' && (
            <>
              <Field label={t('campaign.disputeReason')}>
                <Input required minLength={3} value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </Field>
              <Field label={t('campaign.disputeDetails')}>
                <Textarea required minLength={10} value={form.details ?? ''} onChange={(e) => setForm({ ...form, details: e.target.value })} />
              </Field>
            </>
          )}
          {dialog?.kind === 'brief' && (
            <>
              <Field label={t('campaign.brief')}>
                <Textarea rows={6} defaultValue={c.brief ?? ''} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
              </Field>
              <Field label={t('campaign.mentions')}>
                <Input dir="ltr" defaultValue={c.requiredMentions.join(' ')} onChange={(e) => setForm({ ...form, mentions: e.target.value })} placeholder="@brand" />
              </Field>
              <Field label={t('campaign.hashtags')}>
                <Input dir="ltr" defaultValue={c.requiredHashtags.join(' ')} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="#ad #sponsored" />
              </Field>
            </>
          )}
          <Button type="submit" className="w-full">
            {t('common.submit')}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

export function ReviewsView({ role }: { role: 'BUSINESS' | 'INFLUENCER' }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['my-reviews'], queryFn: () => api<any[]>('/campaigns/reviews/mine') });
  const [resp, setResp] = useState<Record<string, string>>({});
  return (
    <div className="max-w-3xl">
      <PageHeader title={t('profile.reviews')} />
      {!data?.length ? (
        <EmptyState icon={<Star className="h-8 w-8" />} title={t('profile.noReviews')} />
      ) : (
        <div className="space-y-4">
          {data.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-gold-500 text-gold-500' : 'text-stone-300'}`} />
                    ))}
                  </span>
                  <span className="font-medium">{role === 'BUSINESS' ? r.influencer.displayName : r.business.businessName}</span>
                  <span className="text-xs text-stone-500">
                    {r.campaign.number} · {fmtDate(r.createdAt, locale)}
                  </span>
                </div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                {r.response ? (
                  <p className="mt-2 border-s-2 border-gold-400 ps-3 text-sm text-stone-500">{r.response}</p>
                ) : (
                  role === 'INFLUENCER' && (
                    <div className="mt-3 flex gap-2">
                      <Input value={resp[r.id] ?? ''} onChange={(e) => setResp({ ...resp, [r.id]: e.target.value })} placeholder={t('campaign.comment')} />
                      <Button size="sm" onClick={async () => { await api(`/campaigns/reviews/${r.id}/respond`, { body: { response: resp[r.id] } }); qc.invalidateQueries({ queryKey: ['my-reviews'] }); }} disabled={!resp[r.id]}>
                        {t('common.submit')}
                      </Button>
                    </div>
                  )
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
