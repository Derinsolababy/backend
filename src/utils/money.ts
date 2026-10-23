/**
 * Money helpers. Store prices are integer cents; Stellar amounts are strings
 * with up to 7 decimals (stroops). Both are handled as integers (number for
 * cents, bigint for stroops) so no amount ever passes through a float.
 */

export const STROOPS_PER_UNIT = 10_000_000n;

/** "12.5" -> 125000000n. Throws on malformed input or more than 7 decimals. */
export function toStroops(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount.trim());
  if (!match) throw new Error(`Invalid Stellar amount: "${amount}"`);
  const [, whole, frac = ''] = match;
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(frac.padEnd(7, '0'));
}

/** 125000000n -> "12.5000000" (Horizon's canonical format). */
export function fromStroops(stroops: bigint): string {
  if (stroops < 0n) throw new Error('Negative amount');
  const whole = stroops / STROOPS_PER_UNIT;
  const frac = (stroops % STROOPS_PER_UNIT).toString().padStart(7, '0');
  return `${whole}.${frac}`;
}

/**
 * Converts a store-currency total in cents into the Stellar asset amount the
 * customer must pay, given `rate` = store-currency units per 1 asset unit.
 * Rounds up to the next stroop so the merchant is never short-paid.
 */
export function centsToAssetAmount(cents: number, rate: string): string {
  if (!Number.isInteger(cents) || cents < 0)
    throw new Error('cents must be a non-negative integer');
  const rateStroops = toStroops(rate);
  if (rateStroops === 0n) throw new Error('Asset rate must be greater than zero');
  // stroops = (cents / 100) / rate * 1e7 = cents * 1e12 / rateStroops
  const numerator = BigInt(cents) * 1_000_000_000_000n;
  const stroops = (numerator + rateStroops - 1n) / rateStroops;
  return fromStroops(stroops);
}

/** Tax on an amount in cents, rounded half up. */
export function taxCents(amountCents: number, rateBps: number): number {
  return Math.floor((amountCents * rateBps + 5_000) / 10_000);
}
