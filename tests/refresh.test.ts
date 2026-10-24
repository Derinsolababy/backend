import { verifyToken } from '@/middleware/auth.middleware';
import { getDb } from '@/utils/database';
import { api, bearer, signUp, useDatabase } from './helpers';

useDatabase();

describe('POST /auth/refresh', () => {
  it('issues a new valid token for the same user', async () => {
    const { token, id } = await signUp();
    const res = await api().post('/api/v1/auth/refresh').set(bearer(token)).expect(200);
    expect(verifyToken(res.body.data.token).sub).toBe(id);
    expect(res.body.data.user.id).toBe(id);
  });

  it('carries the current role, not the one in the old token', async () => {
    await signUp('Owner');
    const cashier = await signUp('Cashier');
    getDb().prepare("UPDATE users SET role = 'manager' WHERE id = ?").run(cashier.id);
    const res = await api().post('/api/v1/auth/refresh').set(bearer(cashier.token)).expect(200);
    expect(verifyToken(res.body.data.token).role).toBe('manager');
  });

  it('rejects missing tokens and deleted accounts', async () => {
    await api().post('/api/v1/auth/refresh').expect(401);
    const gone = await signUp('Gone');
    getDb().prepare('DELETE FROM users WHERE id = ?').run(gone.id);
    await api().post('/api/v1/auth/refresh').set(bearer(gone.token)).expect(401);
  });
});
