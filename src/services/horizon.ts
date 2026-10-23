/**
 * Thin, typed wrapper over the Horizon API. Everything that talks to the
 * network goes through here, so the rest of the app (and the tests) deal in
 * plain objects instead of SDK response types.
 */
import { Horizon, NotFoundError } from '@stellar/stellar-sdk';
import { config } from '@/config/config';

let server: Horizon.Server | null = null;
const horizon = (): Horizon.Server => (server ??= new Horizon.Server(config.stellar.horizonUrl));

/** A payment-like operation credited to an account. */
export interface IncomingPayment {
  pagingToken: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  /** "XLM" for native. */
  assetCode: string;
  assetIssuer: string | null;
}

export interface TransactionInfo {
  hash: string;
  successful: boolean;
  memo: string | null;
  memoType: string;
  sourceAccount: string;
  createdAt: string;
}

export interface Balance {
  assetCode: string;
  assetIssuer: string | null;
  balance: string;
}

type PaymentLike = {
  type: string;
  paging_token: string;
  transaction_hash: string;
  transaction_successful?: boolean;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};

const PAYMENT_TYPES = new Set([
  'payment',
  'path_payment_strict_receive',
  'path_payment_strict_send',
]);

function normalize(record: PaymentLike): IncomingPayment | null {
  if (!PAYMENT_TYPES.has(record.type) || !record.to || !record.amount) return null;
  if (record.transaction_successful === false) return null;
  const native = record.asset_type === 'native';
  return {
    pagingToken: record.paging_token,
    txHash: record.transaction_hash,
    from: record.from ?? '',
    to: record.to,
    amount: record.amount,
    assetCode: native ? 'XLM' : (record.asset_code ?? ''),
    assetIssuer: native ? null : (record.asset_issuer ?? null),
  };
}

/** Payments to `account` after `cursor`, oldest first. Also returns the new cursor. */
export async function fetchPaymentsSince(
  account: string,
  cursor: string,
  limit = 50,
): Promise<{ payments: IncomingPayment[]; cursor: string }> {
  const page = await horizon()
    .payments()
    .forAccount(account)
    .cursor(cursor)
    .order('asc')
    .limit(limit)
    .call();
  const records = page.records as unknown as PaymentLike[];
  const payments = records
    .map(normalize)
    .filter((p): p is IncomingPayment => p !== null && p.to === account);
  const last = records.at(-1);
  return { payments, cursor: last ? last.paging_token : cursor };
}

/** The most recent paging token for an account, so a fresh watcher skips history. */
export async function latestCursor(account: string): Promise<string> {
  const page = await horizon().payments().forAccount(account).order('desc').limit(1).call();
  return page.records[0]?.paging_token ?? 'now';
}

export async function fetchTransaction(hash: string): Promise<TransactionInfo | null> {
  try {
    const tx = await horizon().transactions().transaction(hash).call();
    return {
      hash: tx.hash,
      successful: tx.successful,
      memo: tx.memo ?? null,
      memoType: tx.memo_type,
      sourceAccount: tx.source_account,
      createdAt: tx.created_at,
    };
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export async function fetchPaymentsInTransaction(hash: string): Promise<IncomingPayment[]> {
  const page = await horizon().operations().forTransaction(hash).limit(100).call();
  return (page.records as unknown as PaymentLike[])
    .map(normalize)
    .filter((p): p is IncomingPayment => p !== null);
}

export async function loadBalances(account: string): Promise<Balance[]> {
  const acct = await horizon().loadAccount(account);
  return acct.balances.map((b) =>
    b.asset_type === 'native'
      ? { assetCode: 'XLM', assetIssuer: null, balance: b.balance }
      : 'asset_code' in b
        ? { assetCode: b.asset_code, assetIssuer: b.asset_issuer, balance: b.balance }
        : { assetCode: b.asset_type, assetIssuer: null, balance: b.balance },
  );
}
