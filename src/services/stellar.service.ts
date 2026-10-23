import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { config } from '@/config/config';
import * as horizon from '@/services/horizon';
import { toStroops } from '@/utils/money';

export interface StellarAssetRef {
  code: string;
  issuer: string | null;
}

export const configuredAsset = (): StellarAssetRef => ({
  code: config.stellar.asset.code,
  issuer: config.stellar.asset.issuer || null,
});

const isNative = (a: StellarAssetRef) => a.code === 'XLM' && !a.issuer;

/**
 * Generates a new keypair. The secret is returned to the caller once and is
 * never logged or stored by this service.
 */
export function generateWallet(): { publicKey: string; secret: string } {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

export const isValidPublicKey = (key: string): boolean => StrKey.isValidEd25519PublicKey(key);

export async function getAccountBalances(publicKey: string): Promise<horizon.Balance[]> {
  if (!isValidPublicKey(publicKey)) throw new Error('Invalid Stellar public key');
  return horizon.loadBalances(publicKey);
}

/**
 * Builds a SEP-0007 `web+stellar:pay` URI. Any SEP-7 wallet (and most
 * Stellar wallets' QR scanners) opens it as a prefilled payment.
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */
export function buildPaymentUri(input: {
  destination: string;
  amount: string;
  asset: StellarAssetRef;
  memo: string;
  message?: string;
}): string {
  const params = new URLSearchParams({ destination: input.destination, amount: input.amount });
  if (!isNative(input.asset)) {
    params.set('asset_code', input.asset.code);
    if (input.asset.issuer) params.set('asset_issuer', input.asset.issuer);
  }
  params.set('memo', input.memo);
  params.set('memo_type', 'MEMO_TEXT');
  if (input.message) params.set('msg', input.message.slice(0, 300));
  if (config.stellar.network !== 'mainnet') {
    params.set('network_passphrase', config.stellar.networkPassphrase);
  }
  // SEP-7 values are percent-encoded; URLSearchParams uses + for spaces.
  return `web+stellar:pay?${params.toString().replace(/\+/g, '%20')}`;
}

export interface Expected {
  destination: string;
  asset: StellarAssetRef;
  /** Minimum amount, 7-decimal string. */
  amount: string;
  memo?: string;
}

export interface Verification {
  verified: boolean;
  reason?: string;
  amount?: string;
  from?: string;
  to?: string;
}

const sameAsset = (p: horizon.IncomingPayment, a: StellarAssetRef) =>
  isNative(a)
    ? p.assetCode === 'XLM' && p.assetIssuer === null
    : p.assetCode === a.code && p.assetIssuer === a.issuer;

/** Checks a single incoming payment against what the checkout expects. */
export function paymentSatisfies(p: horizon.IncomingPayment, expected: Expected): boolean {
  return (
    p.to === expected.destination &&
    sameAsset(p, expected.asset) &&
    toStroops(p.amount) >= toStroops(expected.amount)
  );
}

/**
 * Verifies on-chain that `txHash` is a successful transaction paying at
 * least `expected.amount` of the expected asset to the destination (with the
 * expected memo, when given). Never trusts anything the client sent beyond
 * the hash itself.
 */
export async function verifyPayment(txHash: string, expected: Expected): Promise<Verification> {
  if (!/^[0-9a-f]{64}$/i.test(txHash))
    return { verified: false, reason: 'Malformed transaction hash' };

  const tx = await horizon.fetchTransaction(txHash);
  if (!tx) return { verified: false, reason: 'Transaction not found on the network' };
  if (!tx.successful) return { verified: false, reason: 'Transaction failed on-chain' };
  if (expected.memo !== undefined && tx.memo !== expected.memo) {
    return { verified: false, reason: 'Memo does not match this checkout' };
  }

  const payments = await horizon.fetchPaymentsInTransaction(txHash);
  const match = payments.find((p) => paymentSatisfies(p, expected));
  if (!match) {
    const toUs = payments.find((p) => p.to === expected.destination);
    return {
      verified: false,
      reason: toUs
        ? `Paid ${toUs.amount} ${toUs.assetCode}, expected ${expected.amount} ${expected.asset.code}`
        : 'No payment to the merchant account in this transaction',
    };
  }
  return { verified: true, amount: match.amount, from: match.from, to: match.to };
}
