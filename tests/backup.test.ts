import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { backupDatabase, pruneBackups } from '@/utils/backup';
import { getDb } from '@/utils/database';
import { useDatabase } from './helpers';

useDatabase();

describe('database backups', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'stellarpos-backup-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('writes a readable snapshot of the live database', () => {
    getDb().prepare("INSERT INTO kv (key, value) VALUES ('probe', 'kept')").run();
    const file = backupDatabase(dir, 5);
    const copy = new DatabaseSync(file);
    expect(copy.prepare("SELECT value FROM kv WHERE key = 'probe'").get()).toEqual({
      value: 'kept',
    });
    copy.close();
  });

  it('keeps only the newest backups', () => {
    for (const day of ['01', '02', '03', '04'])
      writeFileSync(join(dir, `stellarpos-2026-01-${day}.db`), '');
    writeFileSync(join(dir, 'notes.txt'), 'untouched');
    const removed = pruneBackups(dir, 2);
    expect(removed.sort()).toEqual(['stellarpos-2026-01-01.db', 'stellarpos-2026-01-02.db']);
    expect(readdirSync(dir).sort()).toEqual([
      'notes.txt',
      'stellarpos-2026-01-03.db',
      'stellarpos-2026-01-04.db',
    ]);
  });
});
