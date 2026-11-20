import { Logo } from '@/components/layout/logo';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between bg-navy-sheen p-12 text-ivory lg:flex">
        <Logo onDark />
        <div>
          <div className="gold-rule mb-6" />
          <p className="max-w-md font-display text-4xl leading-tight">Where Brands Meet Influence.</p>
          <p className="mt-4 font-display text-2xl text-gold-400" dir="rtl" lang="ar">
            حيث تلتقي العلامات التجارية بالتأثير
          </p>
        </div>
        <p className="text-xs text-ivory/50">United Arab Emirates · AED</p>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-5">
          <span className="lg:hidden">
            <Logo />
          </span>
          <span className="ms-auto">
            <LanguageSwitcher />
          </span>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center px-5 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
