'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useMe, useInvalidateMe } from '@/hooks/use-me';
import { useErrorMessage } from '@/hooks/use-error';
import { usePathname, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

export function SettingsView() {
  const t = useTranslations();
  const locale = useLocale();
  const { data: me } = useMe();
  const invalidate = useInvalidateMe();
  const toast = useToast();
  const err = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [code, setCode] = useState('');
  const [testCode, setTestCode] = useState<string | null>(null);
  if (!me) return null;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(err(e), 'error');
    }
  };
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('settings.title')} />
      <Card>
        <CardHeader title={t('settings.language')} description={t('settings.languageHint')} />
        <CardBody>
          <Select
            value={locale}
            onChange={async (e) => {
              const next = e.target.value as 'en' | 'ar';
              await api('/auth/locale', { body: { locale: next } }).catch(() => undefined);
              invalidate();
              router.replace(pathname, { locale: next });
            }}
            className="max-w-xs"
          >
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('settings.verifyPhone')} action={me.phoneVerifiedAt ? <Badge tone="success">{t('settings.verified')}</Badge> : <Badge tone="warning">{t('settings.notVerified')}</Badge>} />
        {!me.phoneVerifiedAt && (
          <CardBody className="flex flex-wrap items-end gap-3">
            <Button
              variant="outline"
              onClick={() =>
                run(async () => {
                  const r = await api('/auth/phone/send-otp', { method: 'POST' });
                  if (r.testCode) setTestCode(r.testCode);
                }, t('notifications.PHONE_OTP.body'))
              }
            >
              {t('settings.sendCode')}
            </Button>
            <Field label={t('settings.code')}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="w-32" placeholder={testCode ?? ''} />
            </Field>
            <Button onClick={() => run(async () => { await api('/auth/phone/verify', { body: { code } }); invalidate(); }, t('settings.verified'))}>{t('settings.verify')}</Button>
          </CardBody>
        )}
      </Card>
      <Card>
        <CardHeader title={t('settings.password')} />
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api('/auth/password/change', { body: pw }), t('common.saved'));
            }}
          >
            <Field label={t('settings.currentPassword')}>
              <Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            </Field>
            <Field label={t('settings.newPassword')} hint={t('auth.passwordHint')}>
              <Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={10} />
            </Field>
            <div>
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('settings.privacy')} description={t('settings.deleteHint')} />
        <CardBody className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() =>
              run(async () => {
                const data = await api('/privacy/export');
                const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
                const a = document.createElement('a');
                a.href = url;
                a.download = 'influencehub-data-export.json';
                a.click();
                URL.revokeObjectURL(url);
              }, t('common.download'))
            }
          >
            {t('settings.export')}
          </Button>
          <Button variant="danger" onClick={() => confirm(t('settings.deleteHint')) && run(() => api('/privacy/deletion', { body: {} }), t('settings.deleteRequested'))}>
            {t('settings.deleteAccount')}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
