import * as horizon from '@/services/horizon';
import { expireStaleRequests, handleIncomingPayment } from '@/services/checkout.service';
import {
  MERCHANT,
  PAYER,
  USDC_ISSUER,
  api,
  bearer,
  createProduct,
  createSale,
  signUp,
  useDatabase,
} from './helpers';

jest.mock('@/services/horizon');
const mocked = jest.mocked(horizon);

useDatabase();

const HASH = 'a'.repeat(64);
const usdc = (
  amount: string,
  overrides: Partial<horizon.IncomingPayment> = {},
): horizon.IncomingPayment => ({
  pagingToken: '1',
  txHash: HASH,
  from: PAYER,
  to: MERCHANT,
  amount,
  assetCode: 'USDC',
  assetIssuer: USDC_ISSUER,
  ...overrides,
});
const tx = (memo: string | null, successful = true): horizon.TransactionInfo => ({
  hash: HASH,
  successful,
  memo,
  memoType: memo ? 'text' : 'none',
  sourceAccount: PAYER,
  createdAt: new Date().toISOString(),
});

let token: string;
let productId: string;

beforeAll(async () => {
  token = (await signUp()).token;
  productId = (await createProduct(token, { priceCents: 1250, stock: 100 })).id;
});

const newSale = () => createSale(token, [{ productId, quantity: 1 }]);

describe('cash and card', () => {
  it('completes a cash sale and computes change', async () => {
    const sale = await newSale();
    const res = await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'cash', tenderedCents: 2000 })
      .expect(201);
    expect(res.body.data.payment).toMatchObject({
      amountCents: 1250,
      changeCents: 750,
      status: 'completed',
    });
    expect(res.body.data.transaction.status).toBe('completed');
  });

  it('supports split tender and refuses to overpay', async () => {
    const sale = await newSale();
    const first = await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'card', amountCents: 1000 })
      .expect(201);
    expect(first.body.data.transaction).toMatchObject({ status: 'pending', balanceCents: 250 });

    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'card', amountCents: 251 })
      .expect(400);
    const second = await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'cash', tenderedCents: 500 })
      .expect(201);
    expect(second.body.data.payment.changeCents).toBe(250);
    expect(second.body.data.transaction.status).toBe('completed');

    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'cash' })
      .expect(409);
  });

  it('rejects cash tendered below the amount', async () => {
    const sale = await newSale();
    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'cash', tenderedCents: 100 })
      .expect(400);
  });
});

describe('Stellar payment by hash', () => {
  it('requires a hash for stellar and forbids one otherwise', async () => {
    const sale = await newSale();
    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'stellar' })
      .expect(400);
    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'card', stellarTxHash: HASH })
      .expect(400);
  });

  it('completes the sale only after on-chain verification', async () => {
    const sale = await newSale();
    mocked.fetchTransaction.mockResolvedValue(tx(null));
    mocked.fetchPaymentsInTransaction.mockResolvedValue([usdc('12.5000000')]);

    const res = await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'stellar', stellarTxHash: HASH })
      .expect(201);
    expect(res.body.data.payment.stellarTxHash).toBe(HASH);
    expect(res.body.data.transaction.status).toBe('completed');

    // The same on-chain payment cannot pay a second sale.
    const other = await newSale();
    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: other.id, method: 'stellar', stellarTxHash: HASH })
      .expect(409);
  });

  it('returns 402 and records the failed attempt when the payment is short', async () => {
    const sale = await newSale();
    const hash = 'b'.repeat(64);
    mocked.fetchTransaction.mockResolvedValue({ ...tx(null), hash });
    mocked.fetchPaymentsInTransaction.mockResolvedValue([usdc('12.4999999', { txHash: hash })]);

    const res = await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'stellar', stellarTxHash: hash })
      .expect(402);
    expect(res.body.error).toMatch(/expected 12.5000000 USDC/);

    const payments = await api().get(`/api/v1/payments/transaction/${sale.id}`).set(bearer(token));
    expect(payments.body.data).toEqual([
      expect.objectContaining({ status: 'failed', method: 'stellar' }),
    ]);
  });

  it('rejects the wrong asset and failed transactions', async () => {
    const sale = await newSale();
    mocked.fetchTransaction.mockResolvedValue({ ...tx(null), hash: 'c'.repeat(64) });
    mocked.fetchPaymentsInTransaction.mockResolvedValue([
      usdc('50.0000000', { assetCode: 'XLM', assetIssuer: null }),
    ]);
    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'stellar', stellarTxHash: 'c'.repeat(64) })
      .expect(402);

    mocked.fetchTransaction.mockResolvedValue(tx(null, false));
    await api()
      .post('/api/v1/payments')
      .set(bearer(token))
      .send({ transactionId: sale.id, method: 'stellar', stellarTxHash: 'd'.repeat(64) })
      .expect(402);
  });
});

describe('QR checkout (SEP-0007 payment requests)', () => {
  it('creates one open request per sale with a SEP-7 URI', async () => {
    const sale = await newSale();
    const res = await api()
      .post('/api/v1/payments/requests')
      .set(bearer(token))
      .send({ transactionId: sale.id })
      .expect(201);
    const req = res.body.data;
    expect(req).toMatchObject({
      amount: '12.5000000',
      assetCode: 'USDC',
      destination: MERCHANT,
      status: 'pending',
    });
    expect(req.memo).toMatch(/^SP[A-Z2-9]{10}$/);

    const uri = new URL(req.uri.replace('web+stellar:', 'https://x/'));
    expect(uri.searchParams.get('destination')).toBe(MERCHANT);
    expect(uri.searchParams.get('amount')).toBe('12.5000000');
    expect(uri.searchParams.get('memo')).toBe(req.memo);
    expect(uri.searchParams.get('network_passphrase')).toBe('Test SDF Network ; September 2015');

    const again = await api()
      .post('/api/v1/payments/requests')
      .set(bearer(token))
      .send({ transactionId: sale.id })
      .expect(201);
    expect(again.body.data.id).toBe(req.id);
  });

  it('settles automatically when the watcher sees a matching payment', async () => {
    const sale = await newSale();
    const { body } = await api()
      .post('/api/v1/payments/requests')
      .set(bearer(token))
      .send({ transactionId: sale.id });
    const hash = 'e'.repeat(64);
    mocked.fetchTransaction.mockResolvedValue({ ...tx(body.data.memo), hash });

    expect(await handleIncomingPayment(usdc('12.5000000', { txHash: hash }))).toBe(true);
    // Replaying the same payment is harmless.
    expect(await handleIncomingPayment(usdc('12.5000000', { txHash: hash }))).toBe(false);

    const request = await api().get(`/api/v1/payments/requests/${body.data.id}`).set(bearer(token));
    expect(request.body.data).toMatchObject({ status: 'paid', txHash: hash, payer: PAYER });
    const saleNow = await api().get(`/api/v1/transactions/${sale.id}`).set(bearer(token));
    expect(saleNow.body.data.status).toBe('completed');
  });

  it('ignores payments with an unknown memo or a short amount', async () => {
    const sale = await newSale();
    const { body } = await api()
      .post('/api/v1/payments/requests')
      .set(bearer(token))
      .send({ transactionId: sale.id });

    mocked.fetchTransaction.mockResolvedValue({ ...tx('SPUNKNOWN000'), hash: 'f'.repeat(64) });
    expect(await handleIncomingPayment(usdc('12.5000000', { txHash: 'f'.repeat(64) }))).toBe(false);

    mocked.fetchTransaction.mockResolvedValue({ ...tx(body.data.memo), hash: '1'.repeat(64) });
    expect(await handleIncomingPayment(usdc('1.0000000', { txHash: '1'.repeat(64) }))).toBe(false);

    const request = await api().get(`/api/v1/payments/requests/${body.data.id}`).set(bearer(token));
    expect(request.body.data.status).toBe('pending');
  });

  it('can be verified manually with a transaction hash', async () => {
    const sale = await newSale();
    const { body } = await api()
      .post('/api/v1/payments/requests')
      .set(bearer(token))
      .send({ transactionId: sale.id });
    const hash = '2'.repeat(64);
    mocked.fetchTransaction.mockResolvedValue({ ...tx('SPWRONGMEMO0'), hash });
    mocked.fetchPaymentsInTransaction.mockResolvedValue([usdc('12.5000000', { txHash: hash })]);
    await api()
      .post(`/api/v1/payments/requests/${body.data.id}/verify`)
      .set(bearer(token))
      .send({ txHash: hash })
      .expect(402);

    mocked.fetchTransaction.mockResolvedValue({ ...tx(body.data.memo), hash });
    const ok = await api()
      .post(`/api/v1/payments/requests/${body.data.id}/verify`)
      .set(bearer(token))
      .send({ txHash: hash })
      .expect(200);
    expect(ok.body.data.request.status).toBe('paid');
    expect(ok.body.data.transaction.status).toBe('completed');
  });

  it('expires stale requests, voids the sale and releases stock', async () => {
    // Expire checkouts left open by earlier tests so the stock baseline is stable.
    expireStaleRequests(new Date(Date.now() + 60 * 60 * 1000));
    const before = (await api().get(`/api/v1/products/${productId}`)).body.data.stock;
    const sale = await newSale();
    const { body } = await api()
      .post('/api/v1/payments/requests')
      .set(bearer(token))
      .send({ transactionId: sale.id });

    expect(expireStaleRequests(new Date(Date.now() + 60 * 60 * 1000))).toBeGreaterThanOrEqual(1);
    const request = await api().get(`/api/v1/payments/requests/${body.data.id}`).set(bearer(token));
    expect(request.body.data.status).toBe('expired');
    const saleNow = await api().get(`/api/v1/transactions/${sale.id}`).set(bearer(token));
    expect(saleNow.body.data.status).toBe('void');
    expect((await api().get(`/api/v1/products/${productId}`)).body.data.stock).toBe(before);
  });

  it('cancels a request without touching the sale', async () => {
    const sale = await newSale();
    const { body } = await api()
      .post('/api/v1/payments/requests')
      .set(bearer(token))
      .send({ transactionId: sale.id });
    const res = await api()
      .post(`/api/v1/payments/requests/${body.data.id}/cancel`)
      .set(bearer(token))
      .expect(200);
    expect(res.body.data.status).toBe('cancelled');
    const saleNow = await api().get(`/api/v1/transactions/${sale.id}`).set(bearer(token));
    expect(saleNow.body.data.status).toBe('pending');
  });
});
