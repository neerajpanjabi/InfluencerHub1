import { CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { buttonVariants } from '@/components/ui/button';

export function ContentPage({ title, intro, points, notice, sections, cta }: { title: string; intro?: string; points?: string[]; notice?: string; sections?: Array<{ h: string; p: string }>; cta?: { href: string; label: string } }) {
  return (
    <div className="container max-w-4xl py-14">
      <div className="gold-rule mb-6" />
      <h1 className="font-display text-4xl text-navy-900 md:text-5xl">{title}</h1>
      {intro && <p className="mt-5 text-lg leading-relaxed text-stone-600">{intro}</p>}
      {notice && <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{notice}</p>}
      {points && (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {points.map((p) => (
            <li key={p} className="flex gap-3 rounded-lg border border-stone-200 bg-white p-5 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-gold-600" />
              {p}
            </li>
          ))}
        </ul>
      )}
      {sections && (
        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl text-navy-900">{s.h}</h2>
              <p className="mt-2 leading-relaxed text-stone-600">{s.p}</p>
            </section>
          ))}
        </div>
      )}
      {cta && (
        <Link href={cta.href} className={buttonVariants({ size: 'lg', className: 'mt-10' })}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}
