import { cn } from '@/lib/utils';

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-stone-200 bg-white shadow-soft', className)} {...p} />;
}
export function CardHeader({ className, title, description, action }: { className?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4', className)}>
      <div>
        <h3 className="font-display text-lg text-navy-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function CardBody({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...p} />;
}
