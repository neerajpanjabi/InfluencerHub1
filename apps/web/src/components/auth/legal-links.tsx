import { Link } from '@/i18n/routing';

/** Tag renderers for t.rich(...) so legal-document names become links (open in a new tab). */
const link = (href: string) => (chunks: React.ReactNode) => (
  <Link href={href} target="_blank" rel="noopener" className="font-medium text-navy-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
    {chunks}
  </Link>
);
export const legalLinks = {
  business: link('/terms/business'),
  creator: link('/terms/creators'),
  platform: link('/terms'),
  privacy: link('/privacy'),
};
