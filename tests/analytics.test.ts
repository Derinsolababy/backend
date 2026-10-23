import { api, bearer, createProduct, createSale, signUp, useDatabase } from './helpers';

useDatabase();

describe('analytics', () => {
  let token: string;

  beforeAll(async () => {
    token = (await signUp()).token;
    const coffee = await createProduct(token, { name: 'Coffee', priceCents: 400, stock: 50 });
    const cake = await createProduct(token, { name: 'Cake', priceCents: 600, stock: 50 });

    const pay = async (id: string, method: string) =>
      api()
        .post('/api/v1/payments')
        .set(bearer(token))
        .send({ transactionId: id, method })
        .expect(201);

    await pay((await createSale(token, [{ productId: coffee.id, quantity: 3 }])).id, 'cash');
    await pay((await createSale(token, [{ productId: cake.id, quantity: 1 }])).id, 'card');
    // A pending sale must not count.
    await createSale(token, [{ productId: cake.id, quantity: 5 }]);
  });

  it('requires authentication', async () => {
    await api().get('/api/v1/analytics/summary').expect(401);
  });

  it('summarizes only completed sales', async () => {
    const res = await api().get('/api/v1/analytics/summary').set(bearer(token)).expect(200);
    expect(res.body.data).toMatchObject({
      totalSales: 2,
      totalRevenueCents: 1800,
      averageTicketCents: 900,
      unitsSold: 4,
    });
    expect(res.body.data.byMethod).toEqual(
      expect.arrayContaining([
        { method: 'cash', count: 1, amountCents: 1200 },
        { method: 'card', count: 1, amountCents: 600 },
      ]),
    );
  });

  it('returns one point per day, including empty days', async () => {
    const res = await api()
      .get('/api/v1/analytics/revenue-by-day?days=7')
      .set(bearer(token))
      .expect(200);
    expect(res.body.data).toHaveLength(7);
    expect(res.body.data.at(-1)).toMatchObject({ sales: 2, revenueCents: 1800 });
    const capped = await api().get('/api/v1/analytics/revenue-by-day?days=500').set(bearer(token));
    expect(capped.body.data).toHaveLength(90);
  });

  it('ranks top products by units sold', async () => {
    const res = await api()
      .get('/api/v1/analytics/top-products?limit=1')
      .set(bearer(token))
      .expect(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ name: 'Coffee', units: 3, revenueCents: 1200 }),
    ]);
  });

  it('returns a 24-hour histogram', async () => {
    const res = await api().get('/api/v1/analytics/hourly').set(bearer(token)).expect(200);
    expect(res.body.data).toHaveLength(24);
  });
});
