// Load environment variables FIRST, before any other imports
import 'dotenv/config';

import { config } from './config.js';
import { logger, generateRunId } from './utils/logger.js';
import { runSync } from './services/sync.js';

async function main() {
  const runId = generateRunId();

  logger.info('VTX Sync Service starting...', { runId });
  logger.debug(`Environment: ${config.NODE_ENV}`, { runId });

  const result = await runSync(runId);

  if (result.success) {
    logger.info('VTX Sync Service completed successfully', {
      runId: result.runId,
      duration: result.duration ? `${Math.round(result.duration / 1000)}s` : 'unknown',
      newRecords: result.newRecords,
      duplicates: result.duplicates,
      totalRows: result.totalRows,
    });
    process.exit(0);
  } else {
    logger.error('VTX Sync Service failed', {
      runId: result.runId,
      phase: result.phase,
      errorCategory: result.errorCategory,
      error: result.error,
      duration: result.duration ? `${Math.round(result.duration / 1000)}s` : 'unknown',
    });
    process.exit(1);
  }
}

main();
