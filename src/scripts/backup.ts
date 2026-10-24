/**
 * One-off backup: npm run db:backup [-- <dir>]
 */
import { backupDatabase } from '@/utils/backup';
import { closeDatabase, connectDatabase } from '@/utils/database';
import { logger } from '@/utils/logger';

async function main() {
  await connectDatabase();
  logger.info(`Backup written to ${backupDatabase(process.argv[2])}`);
}

main()
  .catch((err) => {
    logger.error(`Backup failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
