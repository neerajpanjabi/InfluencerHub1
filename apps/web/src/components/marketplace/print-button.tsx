'use client';
import { Printer } from 'lucide-react';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="flex items-center gap-1 text-navy-700 hover:underline print:hidden">
      <Printer className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
