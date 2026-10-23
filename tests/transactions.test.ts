import { api, bearer, createProduct, createSale, signUp, useDatabase } from './helpers';

useDatabase();

describe('sales', () => {
  let admin: string;
  let cashier: string;
  beforeAll(async () => {
    admin = (await signUp()).token;
    cashier = (await signUp('Cashier')).token;
  });

  const stockOf = async (id: string) => (await api().get(`/api/v1/products/${id}`)).body.data.stock;

  it('prices the cart, reserves stock and assigns a sequential reference', async () => {
    const a = await createProduct(admin, { priceCents: 250, stock: 10 });
    const b = await createProduct(admin, { priceCents: 400, stock: 5 });

    const sale = await createSale(cashier, [
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
      { productId: a.id, quantity: 1 },
    ]);
    expect(sale).toMatchObject({ status: 'pending', totalCents: 1150, reference: 'S-000001' });
    expect(await stockOf(a.id)).toBe(7);
    expect(await stockOf(b.id)).toBe(4);

    const detail = await api()
      .get(`/api/v1/transactions/${sale.id}`)
      .set(bearer(cashier))
      .expect(200);
    // Repeated lines for the same product are merged.
    expect(detail.body.data.items).toHaveLength(2);
    expect(detail.body.data.balanceCents).toBe(1150);

    const next = await createSale(cashier, [{ productId: b.id, quantity: 1 }]);
    expect(next.reference).toBe('S-000002');
  });

  it('rolls back everything when any line lacks stock', async () => {
    const plenty = await createProduct(admin, { stock: 10 });
    const scarce = await createProduct(admin, { stock: 1 });
    const res = await api()
      .post('/api/v1/transactions')
      .set(bearer(cashier))
      .send({
        items: [
          { productId: plenty.id, quantity: 3 },
          { productId: scarce.id, quantity: 2 },
        ],
      })
      .expect(409);
    expect(res.body.error).toMatch(/Insufficient stock/);
    expect(await stockOf(plenty.id)).toBe(10);
    expect(await stockOf(scarce.id)).toBe(1);
  });

  it('rejects unknown products and discounts larger than the subtotal', async () => {
    await api()
      .post('/api/v1/transactions')
      .set(bearer(cashier))
      .send({ items: [{ productId: '00000000-0000-4000-8000-000000000000', quantity: 1 }] })
      .expect(404);
    const p = await createProduct(admin, { priceCents: 100 });
    await api()
      .post('/api/v1/transactions')
      .set(bearer(cashier))
      .send({ items: [{ productId: p.id, quantity: 1 }], discountCents: 101 })
      .expect(400);
  });

  it('voids a pending sale and returns its stock', async () => {
    const p = await createProduct(admin, { stock: 4 });
    const sale = await createSale(cashier, [{ productId: p.id, quantity: 3 }]);
    expect(await stockOf(p.id)).toBe(1);
    const res = await api()
      .post(`/api/v1/transactions/${sale.id}/void`)
      .set(bearer(cashier))
      .expect(200);
    expect(res.body.data.status).toBe('void');
    expect(await stockOf(p.id)).toBe(4);
    await api().post(`/api/v1/transactions/${sale.id}/void`).set(bearer(cashier)).expect(409);
  });

  it('lets only managers refund completed sales, with optional restock', async () => {
    const p = await createProduct(admin, { stock: 5, priceCents: 300 });
    const sale = await createSale(cashier, [{ productId: p.id, quantity: 2 }]);
    await api()
      .post(`/api/v1/transactions/${sale.id}/refund`)
      .set(bearer(admin))
      .send({})
      .expect(409);

    await api()
      .post('/api/v1/payments')
      .set(bearer(cashier))
      .send({ transactionId: sale.id, method: 'card' })
      .expect(201);
    await api()
      .post(`/api/v1/transactions/${sale.id}/refund`)
      .set(bearer(cashier))
      .send({})
      .expect(403);
    const refunded = await api()
      .post(`/api/v1/transactions/${sale.id}/refund`)
      .set(bearer(admin))
      .send({ reason: 'Cold coffee' })
      .expect(200);
    expect(refunded.body.data.status).toBe('refunded');
    expect(refunded.body.data.note).toContain('Cold coffee');
    expect(await stockOf(p.id)).toBe(5);
  });

  it('lists sales newest first and filters by status and reference', async () => {
    const res = await api()
      .get('/api/v1/transactions?status=void')
      .set(bearer(cashier))
      .expect(200);
    expect(res.body.data.every((t: { status: string }) => t.status === 'void')).toBe(true);
    const byRef = await api()
      .get('/api/v1/transactions?search=s-000001')
      .set(bearer(cashier))
      .expect(200);
    expect(byRef.body.data[0].reference).toBe('S-000001');
  });
});

describe('tax', () => {
  it('applies TAX_RATE_BPS after discounts', async () => {
    jest.resetModules();
    process.env.TAX_RATE_BPS = '750';
    const { taxCents } = await import('@/utils/money');
    expect(taxCents(1000, 750)).toBe(75);
    expect(taxCents(999, 750)).toBe(75); // 74.925 rounds half up
    process.env.TAX_RATE_BPS = '0';
  });
});
