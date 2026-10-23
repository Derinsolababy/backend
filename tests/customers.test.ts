import { api, bearer, signUp, useDatabase } from './helpers';

useDatabase();

describe('customers', () => {
  let token: string;
  beforeAll(async () => {
    token = (await signUp()).token;
  });

  it('requires authentication', async () => {
    await api().get('/api/v1/customers').expect(401);
  });

  it('creates, searches, updates and deletes customers', async () => {
    const created = await api()
      .post('/api/v1/customers')
      .set(bearer(token))
      .send({ name: 'Amaka Obi', email: 'AMAKA@example.com', phone: '+234 803 555 0101' })
      .expect(201);
    const id = created.body.data.id;
    expect(created.body.data.email).toBe('amaka@example.com');

    const found = await api().get('/api/v1/customers?search=amaka').set(bearer(token)).expect(200);
    expect(found.body.data).toHaveLength(1);

    const detail = await api().get(`/api/v1/customers/${id}`).set(bearer(token)).expect(200);
    expect(detail.body.data.stats).toEqual({ visits: 0, lifetimeCents: 0, lastVisit: null });

    const updated = await api()
      .put(`/api/v1/customers/${id}`)
      .set(bearer(token))
      .send({ notes: 'Prefers oat milk' })
      .expect(200);
    expect(updated.body.data.notes).toBe('Prefers oat milk');

    await api().delete(`/api/v1/customers/${id}`).set(bearer(token)).expect(200);
    await api().get(`/api/v1/customers/${id}`).set(bearer(token)).expect(404);
  });

  it('only accepts valid Stellar public keys', async () => {
    await api()
      .post('/api/v1/customers')
      .set(bearer(token))
      .send({ name: 'Bad Key', stellarAddress: 'GNOTAKEY' })
      .expect(400);
    await api()
      .post('/api/v1/customers')
      .set(bearer(token))
      .send({
        name: 'Good Key',
        stellarAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      })
      .expect(201);
  });
});
