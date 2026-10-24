import express from 'express';
import request from 'supertest';
import { roleRateLimit } from '@/middleware/rateLimit.middleware';
import { signToken } from '@/middleware/auth.middleware';

function appWith(limits: Parameters<typeof roleRateLimit>[0]) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(roleRateLimit(limits));
  app.get('/', (_req, res) => res.json({ ok: true }));
  return app;
}

const token = (role: 'cashier' | 'manager' | 'admin', sub: string = role) =>
  `Bearer ${signToken({ sub, email: `${sub}@example.com`, role })}`;

async function hits(app: express.Express, n: number, auth?: string) {
  const codes: number[] = [];
  for (let i = 0; i < n; i++) {
    const req = request(app).get('/');
    codes.push((await (auth ? req.set('Authorization', auth) : req)).status);
  }
  return codes;
}

describe('roleRateLimit', () => {
  const limits = { anonymous: 2, cashier: 3, manager: 4, admin: 5 };

  it('gives each role its own budget', async () => {
    const app = appWith(limits);
    expect((await hits(app, 3)).filter((c) => c === 429)).toHaveLength(1);
    expect((await hits(app, 4, token('cashier'))).filter((c) => c === 429)).toHaveLength(1);
    expect((await hits(app, 5, token('manager'))).filter((c) => c === 429)).toHaveLength(1);
    expect((await hits(app, 5, token('admin'))).every((c) => c === 200)).toBe(true);
  });

  it('counts signed-in users per account, not per shared IP', async () => {
    const app = appWith(limits);
    expect((await hits(app, 3, token('cashier', 'till-1'))).every((c) => c === 200)).toBe(true);
    expect((await hits(app, 3, token('cashier', 'till-2'))).every((c) => c === 200)).toBe(true);
  });

  it('treats an invalid token as anonymous', async () => {
    const app = appWith(limits);
    expect((await hits(app, 3, 'Bearer garbage')).at(-1)).toBe(429);
  });
});
