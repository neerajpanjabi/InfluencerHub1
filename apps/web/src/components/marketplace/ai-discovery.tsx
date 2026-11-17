'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, ThumbsDown, ThumbsUp, RotateCcw } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/use-me';
import { useErrorMessage } from '@/hooks/use-error';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Alert, EmptyState } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { CreatorCard } from './creator-card';

interface Turn { query: string; res: any }

export function AiDiscovery() {
  const t = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const err = useErrorMessage();
  const { data: me } = useMe();
  const [query, setQuery] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});
  const last = turns[turns.length - 1];

  const run = async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await api('/ai/recommendations', { body: { query: q, locale, previous: last?.res.understood } });
      setTurns([...turns, { query: q, res }]);
      setQuery('');
    } catch (e) {
      toast(err(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const chips = (u: any) => {
    const out: string[] = [];
    u.specialities?.forEach((s: string) => out.push(s));
    u.categories?.filter((c: string) => !u.specialities?.includes(c)).forEach((c: string) => out.push(c));
    u.emirates?.forEach((e: string) => out.push(t(`enums.emirate.${e}` as any)));
    u.platforms?.forEach((p: string) => out.push(t(`enums.platform.${p}` as any)));
    u.languages?.forEach((l: string) => out.push(t(`enums.language.${l}` as any)));
    if (u.gender) out.push(t(`enums.gender.${u.gender}` as any));
    if (u.minFollowers) out.push(`≥ ${u.minFollowers.toLocaleString()} ${t('common.followers')}`);
    if (u.maxBudget) out.push(`≤ AED ${u.maxBudget}`);
    if (u.budgetTier) out.push(u.budgetTier);
    return out;
  };

  return (
    <div className="container max-w-5xl py-12">
      <p className="eyebrow flex items-center gap-2">
        <Sparkles className="h-4 w-4" /> {t('ai.title')}
      </p>
      <h1 className="mt-2 font-display text-4xl text-navy-900">{t('home.aiCtaTitle')}</h1>
      <p className="mt-2 text-stone-600">{t('ai.subtitle')}</p>

      <form
        className="mt-8 rounded-xl border border-stone-200 bg-white p-4 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
      >
        <Textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder={last ? t('ai.refinePlaceholder') : t('ai.placeholder')} rows={3} className="border-0 text-base focus:ring-0" aria-label={t('ai.title')} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {!last ? (
            <div className="flex flex-wrap gap-2">
              {(t.raw('ai.examples') as string[]).map((ex) => (
                <button key={ex} type="button" onClick={() => run(ex)} className="rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-600 hover:border-gold-500 hover:text-navy-900">
                  {ex}
                </button>
              ))}
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setTurns([])}>
              <RotateCcw className="h-4 w-4" /> {t('ai.newSearch')}
            </Button>
          )}
          <Button type="submit" loading={busy}>
            <Sparkles className="h-4 w-4" /> {last ? t('ai.refine') : t('ai.ask')}
          </Button>
        </div>
      </form>

      {turns.map((turn, idx) => (
        <section key={idx} className={idx < turns.length - 1 ? 'mt-10 opacity-60' : 'mt-10'}>
          <p className="text-sm text-stone-500">“{turn.query}”</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{t('ai.understood')}:</span>
            {chips(turn.res.understood).map((c) => (
              <Badge key={c} tone="gold">
                {c}
              </Badge>
            ))}
            <span className="text-xs text-stone-400">{t('ai.parser', { parser: turn.res.parser })}</span>
          </div>
          {turn.res.relaxed?.length > 0 && <Alert className="mt-3" tone="warning">{t('ai.relaxed', { fields: turn.res.relaxed.join(', ') })}</Alert>}
          {idx === turns.length - 1 &&
            (turn.res.results.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  title={t('ai.noMatches')}
                  body={
                    <ul className="mt-2 space-y-1">
                      {turn.res.suggestions.map((s: any) => (
                        <li key={s.code}>• {t(`ai.suggestions.${s.code}` as any)}</li>
                      ))}
                    </ul>
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {turn.res.results.map((r: any) => (
                    <div key={r.influencer.id} className="flex flex-col">
                      <CreatorCard c={r.influencer} />
                      <div className="-mt-1 rounded-b-lg border border-t-0 border-stone-200 bg-ivory-100 px-5 py-3">
                        <p className="text-xs font-medium text-navy-800">
                          #{r.rank} · {t('ai.why')}
                        </p>
                        <ul className="mt-1.5 space-y-0.5 text-xs text-stone-600">
                          {r.reasons.slice(0, 5).map((reason: any, i: number) => (
                            <li key={i}>✓ {t(`ai.reasons.${reason.code}` as any, reason.params ?? {})}</li>
                          ))}
                        </ul>
                        {me?.type === 'BUSINESS' && r.recommendationId && (
                          <div className="mt-2 flex gap-2">
                            {feedback[r.recommendationId] === undefined ? (
                              <>
                                {[true, false].map((helpful) => (
                                  <button
                                    key={String(helpful)}
                                    className="flex items-center gap-1 text-xs text-stone-500 hover:text-navy-900"
                                    onClick={async () => {
                                      await api('/ai/feedback', { body: { recommendationId: r.recommendationId, helpful } }).catch(() => undefined);
                                      setFeedback({ ...feedback, [r.recommendationId]: helpful });
                                    }}
                                  >
                                    {helpful ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                                    {helpful ? t('ai.helpful') : t('ai.notHelpful')}
                                  </button>
                                ))}
                              </>
                            ) : (
                              <span className="text-xs text-success">{t('ai.thanks')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Link href={`/creators?${turn.res.browseQuery}`} className="mt-6 inline-block text-sm text-navy-700 underline">
                  {t('ai.openInBrowse')}
                </Link>
              </>
            ))}
        </section>
      ))}
    </div>
  );
}
