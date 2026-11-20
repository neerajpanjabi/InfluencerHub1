'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { businessRegistrationSchema, influencerRegistrationSchema, EMIRATE_LABELS, EMIRATES } from '@influencehub/shared';
import { Link, useRouter } from '@/i18n/routing';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/misc';
import { legalLinks } from './legal-links';

export function RegisterForm({ kind }: { kind: 'business' | 'influencer' }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const qc = useQueryClient();
  const err = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const schema = kind === 'business' ? businessRegistrationSchema : influencerRegistrationSchema;
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/categories'), enabled: kind === 'business' });
  const { register, handleSubmit, watch, setValue, formState } = useForm<any>({
    resolver: async (values, ctx, opts) => {
      const v = kind === 'business' ? { ...values, categoryIds: values.categoryId ? [values.categoryId] : [] } : values;
      return (zodResolver(schema as any) as any)(v, ctx, opts);
    },
    defaultValues: { emirate: 'DUBAI', locale, acceptTerms: false, categoryId: '' },
  });
  const e = formState.errors as Record<string, any>;
  const msg = (k: string) => {
    const m = e[k]?.message as string | undefined;
    if (!m) return undefined;
    return m.startsWith('validation.') ? t(m as any) : t('validation.invalid');
  };
  const emirate = watch('emirate') as keyof typeof EMIRATE_LABELS;
  void setValue;

  const onSubmit = async (values: any) => {
    setError(null);
    try {
      const { categoryId, ...rest } = values;
      const body = kind === 'business' ? { ...rest, categoryIds: rest.categoryIds?.length ? rest.categoryIds : [categoryId] } : rest;
      const me = await api(`/auth/register/${kind}`, { body: { ...body, locale } });
      qc.setQueryData(['me'], me);
      router.replace(kind === 'business' ? '/business/onboarding' : '/influencer/onboarding');
    } catch (e2) {
      setError(err(e2));
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-navy-900">{kind === 'business' ? t('auth.businessTitle') : t('auth.influencerTitle')}</h1>
      {error && (
        <Alert tone="danger" className="mt-6">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {kind === 'business' ? (
          <>
            <Field label={t('auth.businessName')} error={msg('businessName')}>
              <Input {...register('businessName')} autoComplete="organization" />
            </Field>
            <Field label={t('auth.contactPerson')} error={msg('contactPerson')}>
              <Input {...register('contactPerson')} autoComplete="name" />
            </Field>
          </>
        ) : (
          <>
            <Field label={t('auth.fullName')} error={msg('fullName')}>
              <Input {...register('fullName')} autoComplete="name" />
            </Field>
            <Field label={t('auth.displayName')} error={msg('displayName')}>
              <Input {...register('displayName')} />
            </Field>
          </>
        )}
        <Field label={t('auth.email')} error={msg('email')}>
          <Input type="email" {...register('email')} autoComplete="email" />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')} error={msg('password')}>
          <Input type="password" {...register('password')} autoComplete="new-password" />
        </Field>
        <Field label={t('auth.phone')} hint={t('auth.phoneHint')} error={msg('phone')}>
          <Input type="tel" dir="ltr" {...register('phone')} autoComplete="tel" placeholder="050 123 4567" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('auth.emirate')} error={msg('emirate')}>
            <Select {...register('emirate')}>
              {EMIRATES.map((x) => (
                <option key={x} value={x}>
                  {t(`enums.emirate.${x}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('auth.city')} error={msg('city')} htmlFor="city">
            <Input id="city" list="cities" {...register('city')} />
            <datalist id="cities">
              {EMIRATE_LABELS[emirate]?.cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        {kind === 'business' && (
          <>
            <Field label={t('auth.category')} error={msg('categoryIds')}>
              <Select {...register('categoryId')}>
                <option value="">—</option>
                {cats.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === 'ar' ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${t('auth.website')} (${t('common.optional')})`} error={msg('website')}>
              <Input type="url" dir="ltr" {...register('website')} placeholder="https://" />
            </Field>
            <Field label={`${t('auth.tradeLicence')} (${t('common.optional')})`}>
              <Input {...register('tradeLicenceNumber')} />
            </Field>
            <Field label={`${t('auth.description')} (${t('common.optional')})`}>
              <Textarea rows={3} {...register('description')} />
            </Field>
          </>
        )}
        <Checkbox label={t.rich(kind === 'business' ? 'auth.acceptTermsBusiness' : 'auth.acceptTermsCreator', legalLinks)} {...register('acceptTerms')} />
        {msg('acceptTerms') && <p className="text-xs text-danger">{msg('acceptTerms')}</p>}
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          {t('auth.registerButton')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-500">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="font-medium text-navy-900 underline">
          {t('auth.loginButton')}
        </Link>
      </p>
      {kind === 'influencer' && <p className="mt-2 text-center text-xs text-stone-400">{t('auth.neverPasswords')}</p>}
    </div>
  );
}
