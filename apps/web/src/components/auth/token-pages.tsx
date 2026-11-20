'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/misc';

export function VerifyEmail() {
  const t = useTranslations('auth');
  const token = useSearchParams().get('token');
  const [state, setState] = useState<'pending' | 'ok' | 'fail'>('pending');
  useEffect(() => {
    if (!token) return setState('fail');
    api('/auth/verify-email', { body: { token } }).then(
      () => setState('ok'),
      () => setState('fail'),
    );
  }, [token]);
  return (
    <div>
      <h1 className="font-display text-3xl">{t('verifyEmailTitle')}</h1>
      {state !== 'pending' && (
        <Alert className="mt-6" tone={state === 'ok' ? 'success' : 'danger'}>
          {state === 'ok' ? t('verifyEmailSuccess') : t('verifyEmailFailed')}
        </Alert>
      )}
      <Link href="/login" className={buttonVariants({ className: 'mt-6' })}>
        {t('loginButton')}
      </Link>
    </div>
  );
}

export function ForgotPassword() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <h1 className="font-display text-3xl">{t('forgotTitle')}</h1>
      <p className="mt-2 text-sm text-stone-500">{t('forgotBody')}</p>
      {sent ? (
        <Alert className="mt-6" tone="success">
          {t('forgotSent')}
        </Alert>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await api('/auth/password/forgot', { body: { email } }).catch(() => undefined);
            setSent(true);
            setBusy(false);
          }}
        >
          <Field label={t('email')}>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            {t('sendLink')}
          </Button>
        </form>
      )}
    </div>
  );
}

export function ResetPassword() {
  const t = useTranslations('auth');
  const err = useErrorMessage();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  return (
    <div>
      <h1 className="font-display text-3xl">{t('resetTitle')}</h1>
      {state.ok ? (
        <>
          <Alert className="mt-6" tone="success">
            {t('resetDone')}
          </Alert>
          <Link href="/login" className={buttonVariants({ className: 'mt-6' })}>
            {t('loginButton')}
          </Link>
        </>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/auth/password/reset', { body: { token, password } });
              setState({ ok: true });
            } catch (e2) {
              setState({ error: err(e2) });
            }
          }}
        >
          {state.error && <Alert tone="danger">{state.error}</Alert>}
          <Field label={t('newPassword')} hint={t('passwordHint')}>
            <Input type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">
            {t('resetTitle')}
          </Button>
        </form>
      )}
    </div>
  );
}
