import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-stone-100 text-stone-700',
      navy: 'bg-navy-100 text-navy-800',
      gold: 'bg-gold-100 text-gold-700',
      success: 'bg-emerald-50 text-success',
      warning: 'bg-amber-50 text-warning',
      danger: 'bg-red-50 text-danger',
      outline: 'border border-stone-300 text-stone-600',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}

const TONES: Record<string, VariantProps<typeof badge>['tone']> = {
  COMPLETED: 'success', PAID: 'success', SUCCEEDED: 'success', VERIFIED: 'success', APPROVED: 'success', PUBLISHED: 'success', CONNECTED: 'success', ACCEPTED: 'success', ACTIVE: 'success', API_VERIFIED: 'success', MATCHED: 'success',
  PENDING: 'warning', PENDING_PAYMENT: 'warning', PAYMENT_PENDING: 'warning', PENDING_REVIEW: 'warning', REQUESTED: 'warning', SUBMITTED: 'warning', CONTENT_SUBMITTED: 'warning', AWAITING_APPROVAL: 'warning', REVISION_REQUESTED: 'warning', TOKEN_EXPIRED: 'warning', PROCESSING: 'warning', PENDING_VERIFICATION: 'warning', MANUALLY_SUBMITTED: 'warning', ON_HOLD: 'warning',
  FAILED: 'danger', CANCELLED: 'danger', REJECTED: 'danger', DISPUTED: 'danger', SUSPENDED: 'danger', ERROR: 'danger', SUSPICIOUS: 'danger', EXPIRED: 'danger', MISMATCH: 'danger', REFUNDED: 'danger',
  IN_PROGRESS: 'navy', CONFIRMED: 'navy', SCHEDULED: 'navy',
};
export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={TONES[status] ?? 'neutral'}>{label}</Badge>;
}
