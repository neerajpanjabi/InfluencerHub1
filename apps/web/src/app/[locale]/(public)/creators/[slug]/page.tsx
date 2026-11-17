import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Clock, MapPin, RefreshCcw, Star } from 'lucide-react';
import { Instagram, Music2 } from '@/components/ui/platform-icons';
import { serverApi } from '@/lib/server-api';
import { fmtDate, fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';
import { Avatar } from '@/components/ui/misc';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GradeBadge, VerificationPill, VerifiedBadges } from '@/components/marketplace/badges';
import { AddToCartButton, ProfileActions } from '@/components/marketplace/profile-actions';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await serverApi<any>(`/influencers/${(await params).slug}`);
  return { title: p?.displayName ?? 'Creator', description: p?.bio?.slice(0, 160) };
}

export default async function CreatorProfile({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const p = await serverApi<any>(`/influencers/${encodeURIComponent(slug)}`, { auth: true });
  if (!p) notFound();
  const ar = locale === 'ar';
  const name = ar && p.displayNameAr ? p.displayNameAr : p.displayName;
  const bio = ar && p.bioAr ? p.bioAr : p.bio;
  const perf = p.performance;
  const now = Date.now();

  return (
    <div className="container py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-6 shadow-soft sm:flex-row sm:items-center">
            <Avatar name={p.displayName} src={p.profileImageUrl} size={96} />
            <div className="flex-1">
              <h1 className="font-display text-3xl text-navy-900">{name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                {p.emirate && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {p.city ? `${p.city}, ` : ''}
                    {t(`enums.emirate.${p.emirate}` as any)}
                  </span>
                )}
                {p.ratingCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-gold-500 text-gold-500" />
                    {Number(p.ratingAverage).toFixed(1)} ({p.ratingCount})
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.categories.map((c: any) => (
                  <Badge key={c.category.slug} tone={c.isPrimary ? 'navy' : 'neutral'}>
                    {ar ? c.category.nameAr : c.category.nameEn}
                  </Badge>
                ))}
              </div>
              <div className="mt-3">
                <VerifiedBadges identity={p.identityStatus} medical={p.medicalStatus} isMedical={p.isMedicalProfessional} sandbox={p.hasSandboxData} />
              </div>
            </div>
            <GradeBadge grade={perf.grade} score={perf.score} size="lg" />
          </div>

          {bio && (
            <Card>
              <CardHeader title={t('profile.about')} />
              <CardBody>
                <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">{bio}</p>
                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                  {p.languages?.length > 0 && (
                    <div>
                      <dt className="text-stone-500">{t('profile.languages')}</dt>
                      <dd>{p.languages.map((l: string) => t(`enums.language.${l}` as any)).join(', ')}</dd>
                    </div>
                  )}
                  {p.specialities?.length > 0 && (
                    <div>
                      <dt className="text-stone-500">{t('profile.specialities')}</dt>
                      <dd>{p.specialities.join(', ')}</dd>
                    </div>
                  )}
                </dl>
              </CardBody>
            </Card>
          )}

          {/* Verified statistics */}
          <Card>
            <CardHeader title={t('profile.metrics')} description={t('profile.connectedPlatforms')} />
            <CardBody className="space-y-6">
              {p.socialAccounts.length === 0 && <p className="text-sm text-stone-500">{t('enums.verification.UNAVAILABLE')}</p>}
              {p.socialAccounts.map((acc: any) => (
                <div key={acc.id}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {acc.platform === 'INSTAGRAM' ? <Instagram className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
                    <span className="font-medium" dir="ltr">
                      @{acc.username}
                    </span>
                    {acc.lastSyncedAt && (
                      <span className="flex items-center gap-1 text-xs text-stone-500">
                        <RefreshCcw className="h-3 w-3" />
                        {t('profile.lastSync', { date: fmtDate(acc.lastSyncedAt, locale, true) })}
                      </span>
                    )}
                    {acc.isSandbox && <Badge tone="warning">{t('common.sandboxData')}</Badge>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(p.metrics[acc.id] ?? []).map((m: any) => (
                      <div key={m.metricType} className="rounded-md border border-stone-100 bg-stone-50/60 p-3">
                        <p className="text-xs text-stone-500">{t(`enums.metric.${m.metricType}` as any)}</p>
                        <p className="mt-1 font-display text-xl text-navy-900">{m.metricType === 'ENGAGEMENT_RATE' ? fmtPercent(m.value, locale) : fmtNumber(m.value, locale)}</p>
                        <VerificationPill status={m.verificationStatus} source={m.source} />
                        <p className="mt-0.5 text-[11px] text-stone-400">
                          {m.sampleSize ? `${t('profile.sample', { count: m.sampleSize })} · ` : ''}
                          {fmtDate(m.collectedAt, locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {p.audience?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">{t('profile.audience')}</p>
                  <div className="space-y-1.5">
                    {p.audience.slice(0, 5).map((a: any) => (
                      <div key={a.key} className="flex items-center gap-3 text-sm">
                        <span className="w-10 text-stone-500" dir="ltr">
                          {a.key}
                        </span>
                        <div className="h-2 flex-1 rounded bg-stone-100">
                          <div className="h-2 rounded bg-navy-700" style={{ width: `${Math.round(a.value * 100)}%` }} />
                        </div>
                        <span className="w-12 text-end">{Math.round(a.value * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Performance */}
          <Card>
            <CardHeader title={t('profile.gradeTitle')} description={t('profile.gradeDisclaimer')} action={<GradeBadge grade={perf.grade} score={perf.score} />} />
            <CardBody>
              {perf.grade === 'NOT_RATED' ? (
                <p className="text-sm text-stone-500">{t('profile.notRatedReason')}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500">{t('profile.coverage', { value: Math.round(Number(perf.coverage) * 100) })}</p>
                  {perf.components.map((c: any) => (
                    <div key={c.key} className="grid grid-cols-[150px_1fr_48px] items-center gap-3 text-sm">
                      <span className="text-stone-600">{t(`profile.components.${c.key}` as any)}</span>
                      <div className="h-2 rounded bg-stone-100">{c.normalized != null && <div className="h-2 rounded bg-gold-500" style={{ width: `${c.normalized}%`, opacity: 0.4 + c.confidence * 0.6 }} />}</div>
                      <span className="text-end text-stone-500">{c.normalized != null ? Math.round(c.normalized) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Services */}
          <Card id="services">
            <CardHeader title={t('profile.services')} />
            <div className="divide-y divide-stone-100">
              {p.services.length === 0 && <p className="p-5 text-sm text-stone-500">{t('common.empty')}</p>}
              {p.services.map((s: any) => {
                const promo = s.promoPrice && (!s.promoEndsAt || new Date(s.promoEndsAt).getTime() > now);
                return (
                  <div key={s.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <p className="font-medium text-navy-900">{ar && s.titleAr ? s.titleAr : s.title}</p>
                      {s.description && <p className="mt-1 text-sm text-stone-500">{ar && s.descriptionAr ? s.descriptionAr : s.description}</p>}
                      <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                        <Badge tone="outline">{t(`enums.platform.${s.platform}` as any)}</Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t('common.days', { count: s.deliveryDays })}
                        </span>
                        <span>{t('common.revisions', { count: s.revisions })}</span>
                        {s.usageRights && <span>{t('profile.usageRights')}: {s.usageRights}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <p className="text-lg font-semibold text-navy-900">
                        {promo && <span className="me-2 text-sm text-stone-400 line-through">{fmtMoney(s.price, locale)}</span>}
                        {fmtMoney(promo ? s.promoPrice : s.price, locale)}
                      </p>
                      <AddToCartButton type="SERVICE" id={s.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {p.packages?.length > 0 && (
            <Card>
              <CardHeader title={t('profile.packages')} />
              <div className="divide-y divide-stone-100">
                {p.packages.map((pk: any) => (
                  <div key={pk.id} className="flex items-center gap-4 p-5">
                    <div className="flex-1">
                      <p className="font-medium">{ar && pk.titleAr ? pk.titleAr : pk.title}</p>
                      <p className="mt-1 text-xs text-stone-500">{pk.items.map((i: any) => `${i.quantity}× ${ar && i.service.titleAr ? i.service.titleAr : i.service.title}`).join(' · ')}</p>
                    </div>
                    <p className="font-semibold">{fmtMoney(pk.price, locale)}</p>
                    <AddToCartButton type="PACKAGE" id={pk.id} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={t('profile.reviews')} />
            <CardBody className="space-y-5">
              {p.reviews.length === 0 && <p className="text-sm text-stone-500">{t('profile.noReviews')}</p>}
              {p.reviews.map((r: any) => (
                <div key={r.id}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < r.rating ? 'fill-gold-500 text-gold-500' : 'text-stone-300'}`} />
                      ))}
                    </span>
                    <span className="font-medium">{r.business.businessName}</span>
                    <span className="text-xs text-stone-400">{fmtDate(r.createdAt, locale)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-stone-700">{r.comment}</p>}
                  {r.response && <p className="mt-2 border-s-2 border-gold-400 ps-3 text-sm text-stone-500">{r.response}</p>}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardBody className="space-y-4">
              {p.startingPrice && (
                <p>
                  <span className="text-sm text-stone-500">{t('search.startingFrom')} </span>
                  <span className="font-display text-2xl text-navy-900">{fmtMoney(p.startingPrice, locale)}</span>
                </p>
              )}
              <Suspense>
                <ProfileActions influencerId={p.id} name={p.displayName} initialSaved={p.viewer?.saved} />
              </Suspense>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
