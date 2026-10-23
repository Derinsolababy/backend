import {
  buildPaymentUri,
  isValidPublicKey,
  generateWallet,
  paymentSatisfies,
} from '@/services/stellar.service';
import { MERCHANT, PAYER, USDC_ISSUER } from './helpers';

describe('stellar service', () => {
  it('generates valid keypairs without exposing them elsewhere', () => {
    const w = generateWallet();
    expect(isValidPublicKey(w.publicKey)).toBe(true);
    expect(w.secret).toMatch(/^S[A-Z2-7]{55}$/);
    expect(isValidPublicKey(w.secret)).toBe(false);
  });

  it('builds a SEP-7 URI for native XLM without asset params', () => {
    const uri = buildPaymentUri({
      destination: MERCHANT,
      amount: '10.0000000',
      asset: { code: 'XLM', issuer: null },
      memo: 'SPABCDEFGHJK',
      message: 'Kofi Coffee S-000001',
    });
    expect(uri.startsWith('web+stellar:pay?')).toBe(true);
    expect(uri).not.toContain('asset_code');
    expect(uri).toContain('msg=Kofi%20Coffee%20S-000001');
    expect(uri).toContain('memo_type=MEMO_TEXT');
  });

  it('matches payments on destination, asset and minimum amount', () => {
    const expected = {
      destination: MERCHANT,
      asset: { code: 'USDC', issuer: USDC_ISSUER },
      amount: '5.0000000',
    };
    const base = {
      pagingToken: '1',
      txHash: 'x',
      from: PAYER,
      to: MERCHANT,
      amount: '5.0000000',
      assetCode: 'USDC',
      assetIssuer: USDC_ISSUER,
    };
    expect(paymentSatisfies(base, expected)).toBe(true);
    expect(paymentSatisfies({ ...base, amount: '5.0000001' }, expected)).toBe(true);
    expect(paymentSatisfies({ ...base, amount: '4.9999999' }, expected)).toBe(false);
    expect(paymentSatisfies({ ...base, to: PAYER }, expected)).toBe(false);
    // Same code, different issuer: a counterfeit USDC.
    expect(paymentSatisfies({ ...base, assetIssuer: PAYER }, expected)).toBe(false);
  });
});
