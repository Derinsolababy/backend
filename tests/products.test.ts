import { api, bearer, createProduct, signUp, useDatabase } from './helpers';

useDatabase();

describe('products', () => {
  let admin: string;
  let cashier: string;

  beforeAll(async () => {
    admin = (await signUp()).token;
    cashier = (await signUp('Cashier')).token;
  });

  it('requires a manager or admin to create', async () => {
    await api().post('/api/v1/products').send({ name: 'X', sku: 'X1', priceCents: 1 }).expect(401);
    await api()
      .post('/api/v1/products')
      .set(bearer(cashier))
      .send({ name: 'X', sku: 'X1', priceCents: 1 })
      .expect(403);
  });

  it('supports the full create, read, update, delete cycle', async () => {
    const created = await api()
      .post('/api/v1/products')
      .set(bearer(admin))
      .send({ name: 'Flat White', sku: 'cof-flw', priceCents: 420, stock: 12, category: 'Coffee' })
      .expect(201);
    const id = created.body.data.id;
    expect(created.body.data).toMatchObject({ sku: 'COF-FLW', priceCents: 420, active: true });

    const list = await api().get('/api/v1/products').expect(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).toContain(id);
    expect(list.body.pagination).toMatchObject({ page: 1, total: 1 });

    const updated = await api()
      .put(`/api/v1/products/${id}`)
      .set(bearer(admin))
      .send({ priceCents: 450 })
      .expect(200);
    expect(updated.body.data.priceCents).toBe(450);

    const del = await api().delete(`/api/v1/products/${id}`).set(bearer(admin)).expect(200);
    expect(del.body.data.outcome).toBe('deleted');
    await api().get(`/api/v1/products/${id}`).expect(404);
  });

  it('rejects duplicate SKUs case-insensitively', async () => {
    await createProduct(admin, { sku: 'DUP-1' });
    await api()
      .post('/api/v1/products')
      .set(bearer(admin))
      .send({ name: 'Other', sku: 'dup-1', priceCents: 100 })
      .expect(409);
  });

  it('searches by name or SKU and filters by category and low stock', async () => {
    await createProduct(admin, {
      name: 'Zobo 350ml',
      sku: 'BEV-ZOB',
      category: 'Drinks',
      stock: 2,
    });
    await createProduct(admin, {
      name: 'Spring Water',
      sku: 'BEV-WAT',
      category: 'Drinks',
      stock: 90,
    });

    const byName = await api().get('/api/v1/products?search=zobo').expect(200);
    expect(byName.body.data).toHaveLength(1);
    const bySku = await api().get('/api/v1/products?search=BEV-').expect(200);
    expect(bySku.body.data).toHaveLength(2);
    const low = await api().get('/api/v1/products?category=Drinks&lowStock=true').expect(200);
    expect(low.body.data.map((p: { sku: string }) => p.sku)).toEqual(['BEV-ZOB']);

    const cats = await api().get('/api/v1/products/categories').expect(200);
    expect(cats.body.data).toContain('Drinks');
  });

  it('treats LIKE wildcards in search as literal characters', async () => {
    const res = await api().get('/api/v1/products?search=%25').expect(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('adjusts stock but never below zero', async () => {
    const p = await createProduct(admin, { stock: 3 });
    const up = await api()
      .post(`/api/v1/products/${p.id}/stock`)
      .set(bearer(admin))
      .send({ delta: 5 })
      .expect(200);
    expect(up.body.data.stock).toBe(8);
    await api()
      .post(`/api/v1/products/${p.id}/stock`)
      .set(bearer(admin))
      .send({ delta: -9 })
      .expect(409);
  });

  it('validates SKU format and price', async () => {
    const res = await api()
      .post('/api/v1/products')
      .set(bearer(admin))
      .send({ name: 'Bad', sku: 'has space', priceCents: -1 })
      .expect(400);
    expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'priceCents',
      'sku',
    ]);
  });
});
