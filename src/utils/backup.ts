import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '@/config/config';
import { getDb } from '@/utils/database';
import { logger } from '@/utils/logger';

const PREFIX = 'stellarpos-';

/**
 * Writes a consistent snapshot of the live database to `dir` using
 * VACUUM INTO, which is safe while the app keeps serving requests. Returns
 * the backup path. Keeps only the newest `keep` backups in that folder.
 */
export function backupDatabase(dir = config.backup.dir, keep = config.backup.keep): string {
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${PREFIX}${stamp}.db`);
  getDb().prepare('VACUUM INTO ?').run(file);
  pruneBackups(dir, keep);
  return file;
}

export function pruneBackups(dir: string, keep: number): string[] {
  const backups = readdirSync(dir)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith('.db'))
    .sort()
    .reverse();
  const removed = backups.slice(Math.max(keep, 1));
  for (const f of removed) rmSync(join(dir, f));
  return removed;
}

let timer: NodeJS.Timeout | null = null;

/** Backs up every BACKUP_INTERVAL_HOURS (0 disables). */
export function startBackupSchedule(): void {
  const hours = config.backup.intervalHours;
  if (!hours || config.database.path === ':memory:') return;
  timer = setInterval(
    () => {
      try {
        logger.info(`Database backed up to ${backupDatabase()}`);
      } catch (err) {
        logger.error(`Database backup failed: ${(err as Error).message}`);
      }
    },
    hours * 60 * 60 * 1000,
  );
  timer.unref();
  logger.info(`Backing up the database every ${hours}h to ${config.backup.dir}`);
}

export function stopBackupSchedule(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
