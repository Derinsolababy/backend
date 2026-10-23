import { api } from './helpers';

describe('GET /health', () => {
  it('reports OK without touching the database', async () => {
    const res = await api().get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'OK',
      environment: 'test',
      stellarNetwork: 'testnet',
    });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await api().get('/api/v1/nope').expect(404);
    expect(res.body).toEqual({ success: false, error: 'Route not found: GET /api/v1/nope' });
  });

  it('rejects malformed JSON with 400', async () => {
    await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
  });
});
