import request from 'supertest';
import { app } from '@/app';
import { closeDatabase, connectDatabase } from '@/utils/database';

export const api = () => request(app);

export const MERCHANT = process.env.STELLAR_MERCHANT_PUBLIC_KEY!;
export const USDC_ISSUER = process.env.STELLAR_ASSET_ISSUER!;

/** Fresh in-memory database per test file. */
export function useDatabase(): void {
  beforeAll(async () => {
    await connectDatabase(':memory:');
  });
  afterAll(() => closeDatabase());
}

let counter = 0;

/** Registers a user and returns its token. The first user in a database is the admin. */
export async function signUp(
  name = 'Ada Admin',
): Promise<{ token: string; id: string; role: string }> {
  counter++;
  const res = await api()
    .post('/api/v1/auth/register')
    .send({ name, email: `user${counter}-${Date.now()}@example.com`, password: 'correct-horse-1' })
    .expect(201);
  return { token: res.body.data.token, id: res.body.data.user.id, role: res.body.data.user.role };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createProduct(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; priceCents: number; stock: number }> {
  counter++;
  const res = await api()
    .post('/api/v1/products')
    .set(bearer(token))
    .send({
      name: `Item ${counter}`,
      sku: `SKU-${counter}`,
      priceCents: 500,
      stock: 10,
      ...overrides,
    })
    .expect(201);
  return res.body.data;
}

export async function createSale(
  token: string,
  items: { productId: string; quantity: number }[],
  extra: Record<string, unknown> = {},
): Promise<{ id: string; totalCents: number; reference: string; status: string }> {
  const res = await api()
    .post('/api/v1/transactions')
    .set(bearer(token))
    .send({ items, ...extra })
    .expect(201);
  return res.body.data;
}
export const PAYER = 'GC2Z3WZA5OPNYITGD33WGZFI7EUZI3VXSLJ4Q32GFLYWED2YNFPJ3SVQ';
