import { cloneElement, forwardRef, isValidElement, useId } from 'react';
import { cn } from '@/lib/utils';

const base = 'w-full rounded border border-stone-300 bg-white px-3 text-sm text-navy-900 placeholder:text-stone-400 focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-gold-200 disabled:bg-stone-100 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(base, 'h-10', className)} {...p} />);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-[96px] py-2 leading-relaxed', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(base, 'h-10 pe-8', className)} {...p}>
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-navy-900', className)} {...p} />;
}

export function Field({ label, error, hint, children, htmlFor }: { label: React.ReactNode; error?: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  const auto = useId();
  // Associate the label with a single form control child (accessibility + testability).
  let id = htmlFor;
  let control = children;
  if (!id && isValidElement(children) && typeof children.type !== 'symbol') {
    const props = children.props as { id?: string };
    id = props.id ?? auto;
    if (!props.id) control = cloneElement(children as React.ReactElement<{ id?: string }>, { id });
  }
  const describedBy = error || hint ? `${id ?? auto}-desc` : undefined;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {describedBy && isValidElement(control) ? cloneElement(control as React.ReactElement<Record<string, unknown>>, { 'aria-describedby': describedBy, ...(error ? { 'aria-invalid': true } : {}) }) : control}
      {hint && !error && <p id={describedBy} className="mt-1 text-xs text-stone-500">{hint}</p>}
      {error && (
        <p id={describedBy} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2 text-sm text-navy-900', className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-navy-900" {...p} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
      <span className="text-navy-900">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-navy-900' : 'bg-stone-300')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'start-[22px]' : 'start-0.5')} />
      </button>
    </label>
  );
}
