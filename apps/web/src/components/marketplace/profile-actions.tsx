'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, Lock, MessageSquare, ShoppingBag, FileText } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { api, newIdempotencyKey } from '@/lib/api';
import { useMe } from '@/hooks/use-me';
import { useErrorMessage } from '@/hooks/use-error';
import { fmtMoney } from '@/lib/format';
import { Button, buttonVariants } from '@/components/ui/button';
import { Alert, Dialog } from '@/components/ui/misc';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export function ProfileActions({ influencerId, name, initialSaved }: { influencerId: string; name: string; initialSaved?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const err = useErrorMessage();
  const sp = useSearchParams();
  const { data: me } = useMe();
  const isBusiness = me?.type === 'BUSINESS';
  const [saved, setSaved] = useState(!!initialSaved);
  const [busy, setBusy] = useState<string | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const status = useQuery({ queryKey: ['contact', influencerId], queryFn: () => api(`/contact/${influencerId}`), enabled: isBusiness });

  useEffect(() => {
    const c = sp.get('contact');
    if (c === 'success') toast(t('profile.paymentSuccess'));
    if (c === 'failed') toast(t('profile.paymentFailed'), 'error');
  }, [sp, t, toast]);

  if (!me || !isBusiness) {
    return (
      <div className="space-y-3">
        <Alert>{t('profile.loginToSave')}</Alert>
        {!me && (
          <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
            {t('nav.login')}
          </Link>
        )}
      </div>
    );
  }

  const unlock = async (useFreeCredit = false) => {
    setBusy('unlock');
    try {
      const r = await api(`/contact/${influencerId}/unlock`, { body: { useFreeCredit, idempotencyKey: newIdempotencyKey() } });
      if (r.checkoutUrl) window.location.href = r.checkoutUrl;
      else router.push(`/business/messages?c=${r.conversationId}`);
    } catch (e) {
      toast(err(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const s = status.data;
  return (
    <div className="space-y-3">
      {s?.allowed ? (
        <Button className="w-full" onClick={() => unlock()} loading={busy === 'unlock'}>
          <MessageSquare className="h-4 w-4" /> {t('profile.contact')}
        </Button>
      ) : s?.reason === 'PAYMENT_REQUIRED' ? (
        <>
          <Button className="w-full" onClick={() => unlock()} loading={busy === 'unlock'}>
            <Lock className="h-4 w-4" /> {t('profile.contactLocked')}
          </Button>
          <p className="text-center text-xs text-stone-500">{t('profile.contactFee', { amount: fmtMoney(s.total, locale, { decimals: true }) })}</p>
          {s.freeAllowanceAvailable && (
            <Button variant="outline" className="w-full" onClick={() => unlock(true)} disabled={!!busy}>
              {t('profile.useFreeContact')}
            </Button>
          )}
        </>
      ) : s?.reason ? (
        <Alert tone="warning">{t.has(`errors.${s.reason}`) ? t(`errors.${s.reason}` as any) : s.reason}</Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const r = await api(`/saved/${influencerId}`, { method: saved ? 'DELETE' : 'PUT' });
              setSaved(r.saved);
            } catch (e) {
              toast(err(e), 'error');
            }
          }}
        >
          {saved ? <BookmarkCheck className="h-4 w-4 text-gold-600" /> : <Bookmark className="h-4 w-4" />}
          {saved ? t('profile.saved') : t('profile.save')}
        </Button>
        <Button variant="outline" onClick={() => setQuoteOpen(true)} disabled={!s?.allowed}>
          <FileText className="h-4 w-4" /> {t('profile.requestQuote')}
        </Button>
      </div>
      <QuoteDialog open={quoteOpen} onClose={() => setQuoteOpen(false)} influencerId={influencerId} name={name} />
    </div>
  );
}

function QuoteDialog({ open, onClose, influencerId, name }: { open: boolean; onClose: () => void; influencerId: string; name: string }) {
  const t = useTranslations();
  const toast = useToast();
  const err = useErrorMessage();
  const [brief, setBrief] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title={`${t('profile.requestQuote')} — ${name}`}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('/quotations', { body: { influencerId, brief, requestedBudget: budget ? Number(budget) : undefined } });
            toast(t('profile.quoteSent'));
            onClose();
          } catch (e2) {
            toast(err(e2), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={t('profile.quoteBrief')}>
          <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} minLength={20} maxLength={5000} required rows={6} />
        </Field>
        <Field label={t('profile.quoteBudget')}>
          <Input type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          {t('profile.sendRequest')}
        </Button>
      </form>
    </Dialog>
  );
}

export function AddToCartButton({ type, id }: { type: 'SERVICE' | 'PACKAGE'; id: string }) {
  const t = useTranslations();
  const toast = useToast();
  const err = useErrorMessage();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  if (me?.type !== 'BUSINESS') return null;
  return (
    <Button
      size="sm"
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api('/cart/items', { body: { type, id, quantity: 1 } });
          qc.invalidateQueries({ queryKey: ['cart'] });
          toast(t('profile.addedToCart'));
        } catch (e) {
          toast(err(e), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <ShoppingBag className="h-4 w-4" /> {t('profile.addToCart')}
    </Button>
  );
}
