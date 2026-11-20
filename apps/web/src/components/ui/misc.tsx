'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-stone-200/70', className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      {icon && <div className="mb-3 text-gold-600">{icon}</div>}
      <p className="font-display text-lg text-navy-900">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-stone-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = 'info', children, className }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: React.ReactNode; className?: string }) {
  const tones = { info: 'border-navy-100 bg-navy-50 text-navy-800', warning: 'border-amber-200 bg-amber-50 text-amber-900', danger: 'border-red-200 bg-red-50 text-red-800', success: 'border-emerald-200 bg-emerald-50 text-emerald-900' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded border px-4 py-3 text-sm', tones[tone], className)}>
      {children}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white shadow-lift sm:rounded-xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="font-display text-lg text-navy-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: React.ReactNode }> }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-stone-200" role="tablist">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn('-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors', value === i.value ? 'border-gold-500 font-medium text-navy-900' : 'border-transparent text-stone-500 hover:text-navy-900')}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <div aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-navy-900 font-display text-gold-400', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>{label}</span>
        {icon && <span className="text-gold-600">{icon}</span>}
      </div>
      <div className="mt-2 font-display text-2xl text-navy-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl text-navy-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: React.ReactNode[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-start text-xs uppercase tracking-wide text-stone-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-sm text-stone-500">—</p>}
    </div>
  );
}
export function Td({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-top text-navy-900', className)} {...p} />;
}
