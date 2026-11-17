import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function Logo({ onDark, className }: { onDark?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn('flex items-center gap-2', className)} aria-label="InfluenceHub">
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="12" fill={onDark ? '#C8A96A' : '#0B1B33'} />
        <path d="M20 18h6v28h-6zM38 18h6v28h-6zM26 29h12v6H26z" fill={onDark ? '#0B1B33' : '#C8A96A'} />
      </svg>
      <span className={cn('font-display text-xl tracking-tight', onDark ? 'text-ivory' : 'text-navy-900')} dir="ltr">
        Influence<span className="text-gold-500">Hub</span>
      </span>
    </Link>
  );
}
