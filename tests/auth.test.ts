import { api, bearer, signUp, useDatabase } from './helpers';

useDatabase();

describe('auth', () => {
  const email = 'owner@example.com';
  const password = 'correct-horse-1';
  let token: string;

  it('registers the first user as admin and never returns the password hash', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Owner', email, password })
      .expect(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email, role: 'admin' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    token = res.body.data.token;
  });

  it('registers later users as cashiers', async () => {
    const second = await signUp('Second');
    expect(second.role).toBe('cashier');
  });

  it('rejects a duplicate email regardless of case', async () => {
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email: email.toUpperCase(), password })
      .expect(409);
  });

  it('validates input and reports every problem at once', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);
    const fields = res.body.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['email', 'name', 'password']);
  });

  it('logs in with correct credentials', async () => {
    const res = await api().post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrong = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'nope-nope' })
      .expect(401);
    const unknown = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.com', password })
      .expect(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('returns the current user for a valid token and 401 otherwise', async () => {
    const res = await api().get('/api/v1/auth/me').set(bearer(token)).expect(200);
    expect(res.body.data.email).toBe(email);
    await api().get('/api/v1/auth/me').expect(401);
    await api().get('/api/v1/auth/me').set(bearer('garbage')).expect(401);
  });

  it('changes the password only with the current one', async () => {
    await api()
      .patch('/api/v1/auth/me')
      .set(bearer(token))
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password-2' })
      .expect(400);
    await api()
      .patch('/api/v1/auth/me')
      .set(bearer(token))
      .send({ currentPassword: password, newPassword: 'new-password-2' })
      .expect(200);
    await api().post('/api/v1/auth/login').send({ email, password: 'new-password-2' }).expect(200);
  });
});

describe('staff management', () => {
  it('lets admins add staff and change roles, and nobody else', async () => {
    const admin = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'owner@example.com', password: 'new-password-2' });
    const adminToken = admin.body.data.token;
    const cashier = await signUp('Cashier');

    await api().get('/api/v1/users').set(bearer(cashier.token)).expect(403);

    const created = await api()
      .post('/api/v1/users')
      .set(bearer(adminToken))
      .send({ name: 'Mgr', email: 'mgr@example.com', password: 'correct-horse-1', role: 'manager' })
      .expect(201);
    expect(created.body.data.role).toBe('manager');

    await api()
      .patch(`/api/v1/users/${cashier.id}/role`)
      .set(bearer(adminToken))
      .send({ role: 'manager' })
      .expect(200);
    const list = await api().get('/api/v1/users').set(bearer(adminToken)).expect(200);
    expect(list.body.data.find((u: { id: string }) => u.id === cashier.id).role).toBe('manager');
  });
});
