import { getDb } from '@/utils/database';
import { newId } from '@/utils/helpers';

export type PaymentRequestStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

interface RequestRow {
  id: string;
  transaction_id: string;
  destination: string;
  asset_code: string;
  asset_issuer: string | null;
  amount: string;
  memo: string;
  uri: string;
  status: PaymentRequestStatus;
  tx_hash: string | null;
  payer: string | null;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
}

/** A Stellar checkout: what the customer's wallet must pay, and its outcome. */
export interface PaymentRequest {
  id: string;
  transactionId: string;
  destination: string;
  assetCode: string;
  assetIssuer: string | null;
  amount: string;
  memo: string;
  uri: string;
  status: PaymentRequestStatus;
  txHash: string | null;
  payer: string | null;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
}

const toRequest = (r: RequestRow): PaymentRequest => ({
  id: r.id,
  transactionId: r.transaction_id,
  destination: r.destination,
  assetCode: r.asset_code,
  assetIssuer: r.asset_issuer,
  amount: r.amount,
  memo: r.memo,
  uri: r.uri,
  status: r.status,
  txHash: r.tx_hash,
  payer: r.payer,
  expiresAt: r.expires_at,
  paidAt: r.paid_at,
  createdAt: r.created_at,
});

export const PaymentRequestModel = {
  create(
    input: Omit<PaymentRequest, 'id' | 'status' | 'txHash' | 'payer' | 'paidAt' | 'createdAt'>,
  ): PaymentRequest {
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO payment_requests
           (id, transaction_id, destination, asset_code, asset_issuer, amount, memo, uri, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        id,
        input.transactionId,
        input.destination,
        input.assetCode,
        input.assetIssuer,
        input.amount,
        input.memo,
        input.uri,
        input.expiresAt,
      );
    return this.findById(id)!;
  },

  findById(id: string): PaymentRequest | undefined {
    const row = getDb().prepare('SELECT * FROM payment_requests WHERE id = ?').get(id) as
      RequestRow | undefined;
    return row && toRequest(row);
  },

  findPendingByMemo(memo: string): PaymentRequest | undefined {
    const row = getDb()
      .prepare("SELECT * FROM payment_requests WHERE memo = ? AND status = 'pending'")
      .get(memo) as RequestRow | undefined;
    return row && toRequest(row);
  },

  findOpenForTransaction(transactionId: string): PaymentRequest | undefined {
    const row = getDb()
      .prepare(
        "SELECT * FROM payment_requests WHERE transaction_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
      )
      .get(transactionId) as RequestRow | undefined;
    return row && toRequest(row);
  },

  listExpired(nowIso: string): PaymentRequest[] {
    const rows = getDb()
      .prepare("SELECT * FROM payment_requests WHERE status = 'pending' AND expires_at <= ?")
      .all(nowIso) as unknown as RequestRow[];
    return rows.map(toRequest);
  },

  markPaid(id: string, txHash: string, payer: string): boolean {
    return (
      getDb()
        .prepare(
          `UPDATE payment_requests SET status = 'paid', tx_hash = ?, payer = ?, paid_at = datetime('now')
           WHERE id = ? AND status = 'pending'`,
        )
        .run(txHash, payer, id).changes === 1
    );
  },

  setStatus(id: string, status: PaymentRequestStatus): void {
    getDb().prepare('UPDATE payment_requests SET status = ? WHERE id = ?').run(status, id);
  },
};
