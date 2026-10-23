import { centsToAssetAmount, fromStroops, taxCents, toStroops } from '@/utils/money';

describe('money', () => {
  it('round-trips Stellar amounts through stroops', () => {
    expect(toStroops('12.5')).toBe(125_000_000n);
    expect(toStroops('0.0000001')).toBe(1n);
    expect(fromStroops(125_000_000n)).toBe('12.5000000');
    expect(fromStroops(toStroops('922337203685.4775807'))).toBe('922337203685.4775807');
  });

  it('rejects malformed amounts', () => {
    for (const bad of ['', '-1', '1.12345678', '1e5', 'abc', '1.']) {
      expect(() => toStroops(bad)).toThrow();
    }
  });

  it('converts cents to asset amounts and never rounds against the merchant', () => {
    expect(centsToAssetAmount(1250, '1')).toBe('12.5000000');
    // 1 USD at 0.3 USD per XLM = 3.3333333... XLM, rounded up.
    expect(centsToAssetAmount(100, '0.3')).toBe('3.3333334');
    expect(centsToAssetAmount(0, '1')).toBe('0.0000000');
    expect(() => centsToAssetAmount(100, '0')).toThrow();
    expect(() => centsToAssetAmount(1.5, '1')).toThrow();
  });

  it('computes tax with half-up rounding', () => {
    expect(taxCents(1000, 0)).toBe(0);
    expect(taxCents(1000, 750)).toBe(75);
    expect(taxCents(10, 750)).toBe(1); // 0.75 -> 1
    expect(taxCents(6, 750)).toBe(0); // 0.45 -> 0
  });
});
