'use client';
import { useTranslations } from 'next-intl';
import { fmtDate, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';

export function InvoiceView({ inv, locale }: { inv: any; locale: string }) {
  const t = useTranslations();
  const m = (v: string) => fmtMoney(v, locale, { decimals: true });
  return (
    <div className="space-y-4 text-sm" id="invoice">
      <div className="flex justify-between">
        <div>
          <p className="font-display text-xl">{inv.issuedBy.name}</p>
          <p className="text-stone-500">{inv.issuedBy.address}</p>
          {inv.issuedBy.trn && <p className="text-stone-500">TRN {inv.issuedBy.trn}</p>}
        </div>
        <div className="text-end">
          <p className="font-medium">{inv.number}</p>
          <p className="text-stone-500">{fmtDate(inv.issuedAt, locale)}</p>
        </div>
      </div>
      <div>
        <p className="font-medium">{inv.issuedTo.name}</p>
        <p className="text-stone-500">{inv.issuedTo.email}</p>
        {inv.issuedTo.trn && <p className="text-stone-500">TRN {inv.issuedTo.trn}</p>}
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-stone-100">
          {inv.lines.map((l: any, i: number) => (
            <tr key={i}>
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-end">{m(l.net)}</td>
              <td className="py-2 text-end text-stone-500">{m(l.vat)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ms-auto w-60 space-y-1">
        <div className="flex justify-between"><dt>{t('business.cart.subtotal')}</dt><dd>{m(inv.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>VAT</dt><dd>{m(inv.vatTotal)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>{t('common.total')}</dt><dd>{m(inv.total)}</dd></div>
      </dl>
      <Button variant="outline" size="sm" onClick={() => window.print()}>{t('common.download')}</Button>
    </div>
  );
}

