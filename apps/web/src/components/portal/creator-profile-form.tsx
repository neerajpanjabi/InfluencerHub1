'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EMIRATES, LANGUAGES } from '@influencehub/shared';
import { api, uploadFile } from '@/lib/api';
import { useErrorMessage } from '@/hooks/use-error';
import { useInvalidateMe } from '@/hooks/use-me';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Select, Switch, Textarea } from '@/components/ui/input';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';

const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function CreatorProfileForm({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorMessage();
  const invalidate = useInvalidateMe();
  const { data: p } = useQuery({ queryKey: ['inf-profile'], queryFn: () => api<any>('/influencers/me/profile') });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<any[]>('/categories') });
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (p)
      setF({
        displayName: p.displayName, displayNameAr: p.displayNameAr ?? '', bio: p.bio ?? '', bioAr: p.bioAr ?? '', emirate: p.emirate ?? 'DUBAI', city: p.city ?? '', gender: p.gender,
        languages: p.languages, specialities: p.specialities.join(', '), contentNiches: p.contentNiches.join(', '), audienceLocations: p.audienceLocations.join(', '),
        categoryIds: p.categories.sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary)).map((c: any) => c.categoryId), isPublic: p.isPublic, acceptingBookings: p.acceptingBookings,
        visibility: { showCity: true, showGender: true, showAudience: true, showStoryViews: true, showLanguages: true, ...(p.visibility ?? {}) },
      });
  }, [p]);
  if (!p || !f) return <Skeleton className="h-96" />;
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const allCats = (cats.data ?? []).flatMap((c: any) => [c, ...c.children.map((ch: any) => ({ ...ch, parentName: locale === 'ar' ? c.nameAr : c.nameEn }))]);
  const save = async () => {
    try {
      await api('/influencers/me/profile', {
        method: 'PATCH',
        body: {
          displayName: f.displayName, displayNameAr: f.displayNameAr || null, bio: f.bio || null, bioAr: f.bioAr || null, emirate: f.emirate, city: f.city, gender: f.gender,
          languages: f.languages, specialities: split(f.specialities), contentNiches: split(f.contentNiches), audienceLocations: split(f.audienceLocations).map((x) => x.toUpperCase()),
          categoryIds: f.categoryIds, primaryCategoryId: f.categoryIds[0], isPublic: f.isPublic, acceptingBookings: f.acceptingBookings, visibility: f.visibility,
        },
      });
      qc.invalidateQueries({ queryKey: ['inf-profile'] });
      invalidate();
      toast(t('common.saved'));
      onSaved?.();
    } catch (e) {
      toast(err(e), 'error');
    }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <Avatar name={p.displayName} src={p.profileImageUrl} size={72} />
            <label className="cursor-pointer text-sm underline">
              {t('influencer.profile.photo')}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { if (e.target.files?.[0]) { await uploadFile(e.target.files[0], 'AVATAR').catch((x) => toast(err(x), 'error')); qc.invalidateQueries({ queryKey: ['inf-profile'] }); invalidate(); } }} />
            </label>
          </div>
          <Field label={t('auth.displayName')}><Input value={f.displayName} onChange={set('displayName')} /></Field>
          <Field label={t('influencer.profile.displayNameAr')}><Input dir="rtl" value={f.displayNameAr} onChange={set('displayNameAr')} /></Field>
          <div className="sm:col-span-2"><Field label={t('influencer.profile.bio')}><Textarea rows={4} value={f.bio} onChange={set('bio')} /></Field></div>
          <div className="sm:col-span-2"><Field label={t('influencer.profile.bioAr')}><Textarea dir="rtl" rows={4} value={f.bioAr} onChange={set('bioAr')} /></Field></div>
          <Field label={t('auth.emirate')}><Select value={f.emirate} onChange={set('emirate')}>{EMIRATES.map((x) => <option key={x} value={x}>{t(`enums.emirate.${x}`)}</option>)}</Select></Field>
          <Field label={t('auth.city')}><Input value={f.city} onChange={set('city')} /></Field>
          <Field label={t('search.gender')}><Select value={f.gender} onChange={set('gender')}>{['FEMALE', 'MALE', 'UNDISCLOSED'].map((g) => <option key={g} value={g}>{t(`enums.gender.${g}` as any)}</option>)}</Select></Field>
          <Field label={t('influencer.profile.audienceLocations')}><Input dir="ltr" value={f.audienceLocations} onChange={set('audienceLocations')} placeholder="AE, SA, IN" /></Field>
          <div className="sm:col-span-2">
            <Field label={t('profile.languages')}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.keys(LANGUAGES).map((l) => (
                  <Checkbox key={l} label={t(`enums.language.${l}` as any)} checked={f.languages.includes(l)} onChange={() => setF({ ...f, languages: f.languages.includes(l) ? f.languages.filter((x: string) => x !== l) : [...f.languages, l] })} />
                ))}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('influencer.profile.categories')}>
              <Select multiple size={8} value={f.categoryIds} onChange={(e) => setF({ ...f, categoryIds: Array.from(e.target.selectedOptions).map((o) => o.value).slice(0, 8) })} className="h-48">
                {allCats.map((c: any) => <option key={c.id} value={c.id}>{c.parentName ? `${c.parentName} › ` : ''}{locale === 'ar' ? c.nameAr : c.nameEn}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t('influencer.profile.specialities')}><Input value={f.specialities} onChange={set('specialities')} /></Field>
          <Field label={t('influencer.profile.niches')}><Input value={f.contentNiches} onChange={set('contentNiches')} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t('influencer.profile.visibility')} />
        <CardBody className="space-y-3">
          <Switch label={<span><strong>{t('influencer.profile.public')}</strong><span className="block text-xs text-stone-500">{t('influencer.profile.publicHint')}</span></span>} checked={f.isPublic} onChange={(v) => setF({ ...f, isPublic: v })} />
          <Switch label={t('influencer.availability.accepting')} checked={f.acceptingBookings} onChange={(v) => setF({ ...f, acceptingBookings: v })} />
          {(['showCity', 'showGender', 'showAudience', 'showStoryViews', 'showLanguages'] as const).map((k) => (
            <Switch key={k} label={t(`influencer.profile.${k}`)} checked={f.visibility[k]} onChange={(v) => setF({ ...f, visibility: { ...f.visibility, [k]: v } })} />
          ))}
        </CardBody>
      </Card>
      <Button size="lg" onClick={save}>{t('common.save')}</Button>
    </div>
  );
}
