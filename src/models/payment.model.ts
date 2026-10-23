import { getDb } from '@/utils/database';
import { newId } from '@/utils/helpers';

export const PAYMENT_METHODS = ['cash', 'card', 'stellar'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = 'pending' | 'completed' | 'failed';

interface PaymentRow {
  id: string;
  transaction_id: string;
  method: PaymentMethod;
  amount_cents: number;
  tendered_cents: number | null;
  change_cents: number | null;
  status: PaymentStatus;
  stellar_tx_hash: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  method: PaymentMethod;
  amountCents: number;
  tenderedCents: number | null;
  changeCents: number | null;
  status: PaymentStatus;
  stellarTxHash: string | null;
  createdAt: string;
}

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  transactionId: r.transaction_id,
  method: r.method,
  amountCents: r.amount_cents,
  tenderedCents: r.tendered_cents,
  changeCents: r.change_cents,
  status: r.status,
  stellarTxHash: r.stellar_tx_hash,
  createdAt: r.created_at,
});

export const PaymentModel = {
  create(input: {
    transactionId: string;
    method: PaymentMethod;
    amountCents: number;
    status: PaymentStatus;
    tenderedCents?: number | null;
    changeCents?: number | null;
    stellarTxHash?: string | null;
  }): Payment {
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO payments
           (id, transaction_id, method, amount_cents, tendered_cents, change_cents, status, stellar_tx_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.transactionId,
        input.method,
        input.amountCents,
        input.tenderedCents ?? null,
        input.changeCents ?? null,
        input.status,
        input.stellarTxHash ?? null,
      );
    return this.findById(id)!;
  },

  findById(id: string): Payment | undefined {
    const row = getDb().prepare('SELECT * FROM payments WHERE id = ?').get(id) as
      PaymentRow | undefined;
    return row && toPayment(row);
  },

  findByTransactionId(transactionId: string): Payment[] {
    const rows = getDb()
      .prepare('SELECT * FROM payments WHERE transaction_id = ? ORDER BY created_at, rowid')
      .all(transactionId) as unknown as PaymentRow[];
    return rows.map(toPayment);
  },

  findByStellarHash(hash: string): Payment | undefined {
    const row = getDb().prepare('SELECT * FROM payments WHERE stellar_tx_hash = ?').get(hash) as
      PaymentRow | undefined;
    return row && toPayment(row);
  },

  updateStatus(id: string, status: PaymentStatus): void {
    getDb().prepare('UPDATE payments SET status = ? WHERE id = ?').run(status, id);
  },
};
