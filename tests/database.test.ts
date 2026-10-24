import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDatabase, connectDatabase, getDb } from '@/utils/database';
import { api } from './helpers';

const pragma = (name: string) =>
  Object.values(getDb().prepare(`PRAGMA ${name}`).get() as object)[0];

describe('database under load', () => {
  let dir: string;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'stellarpos-'));
    await connectDatabase(join(dir, 'test.db'));
  });
  afterAll(() => {
    closeDatabase();
    rmSync(dir, { recursive: true, force: true });
  });

  it('waits for locks instead of failing with SQLITE_BUSY', () => {
    expect(pragma('busy_timeout')).toBe(5000);
  });

  it('uses WAL with NORMAL sync for file databases', () => {
    expect(pragma('journal_mode')).toBe('wal');
    expect(pragma('synchronous')).toBe(1);
  });

  it('reports the database in /health', async () => {
    const res = await api().get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'OK', database: 'up' });
  });
});

describe('/health without a database', () => {
  it('returns 503 so load balancers route around the instance', async () => {
    const res = await api().get('/health').expect(503);
    expect(res.body).toMatchObject({ status: 'DEGRADED', database: 'down' });
  });
});
