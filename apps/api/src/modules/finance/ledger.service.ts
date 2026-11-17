import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LedgerAccount, Prisma } from '@influencehub/database';
import { fromMinor } from '@influencehub/shared';

export interface LedgerLine {
  account: LedgerAccount;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  influencerId?: string | null;
  businessId?: string | null;
  categoryId?: string | null;
  description: string;
}

/**
 * Append-only double-entry ledger. Each posting is a balanced transaction (enforced here AND by
 * a deferred PostgreSQL constraint trigger). Entries are never updated or deleted (DB trigger).
 */
@Injectable()
export class LedgerService {
  async post(tx: Prisma.TransactionClient, ref: { type: string; id: string }, lines: LedgerLine[]) {
    const nonZero = lines.filter((l) => l.amountMinor !== 0);
    if (nonZero.some((l) => l.amountMinor < 0 || !Number.isInteger(l.amountMinor))) throw new Error('Ledger amounts must be positive integers (minor units)');
    const debit = nonZero.filter((l) => l.direction === 'DEBIT').reduce((a, l) => a + l.amountMinor, 0);
    const credit = nonZero.filter((l) => l.direction === 'CREDIT').reduce((a, l) => a + l.amountMinor, 0);
    if (debit !== credit) throw new Error(`Unbalanced ledger posting (${debit} != ${credit})`);
    const transactionId = randomUUID();
    await tx.financialLedger.createMany({
      data: nonZero.map((l) => ({
        transactionId,
        account: l.account,
        direction: l.direction,
        amount: new Prisma.Decimal(fromMinor(l.amountMinor)),
        referenceType: ref.type,
        referenceId: ref.id,
        influencerId: l.influencerId ?? null,
        businessId: l.businessId ?? null,
        categoryId: l.categoryId ?? null,
        description: l.description,
      })),
    });
    return transactionId;
  }
}

export async function nextNumber(tx: Prisma.TransactionClient | { $queryRawUnsafe: any }, seq: 'order_number_seq' | 'invoice_number_seq' | 'campaign_number_seq' | 'quotation_number_seq', prefix: string) {
  // `seq` is a fixed internal identifier from the union type above — never user input.
  const rows = (await (tx as any).$queryRawUnsafe(`SELECT nextval('${seq}') AS n`)) as Array<{ n: bigint }>;
  const n = Number(rows[0].n);
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String(n).padStart(6, '0')}`;
}
