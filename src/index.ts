// Load environment variables FIRST, before any other imports
import 'dotenv/config';

import { config } from './config.js';
import { logger, generateRunId } from './utils/logger.js';
import { runSyncWithRetry } from './services/retry.js';

async function main() {
  const runId = generateRunId();

  logger.info('VTX Sync Service starting...', { runId });
  logger.debug(`Environment: ${config.NODE_ENV}`, { runId });

  const result = await runSyncWithRetry(runId);

  if (result.success) {
    const retryNote = result.wasRetry ? ' (succeeded on retry)' : '';
    logger.info(`VTX Sync Service completed successfully${retryNote}`, {
      runId: result.runId,
      duration: result.duration ? `${Math.round(result.duration / 1000)}s` : 'unknown',
      newRecords: result.newRecords,
      duplicates: result.duplicates,
      totalRows: result.totalRows,
      wasRetry: result.wasRetry,
    });
    process.exit(0);
  } else {
    const retryNote = result.isRetryExhausted ? ' (retry exhausted)' : '';
    logger.error(`VTX Sync Service failed${retryNote}`, {
      runId: result.runId,
      phase: result.phase,
      errorCategory: result.errorCategory,
      error: result.error,
      duration: result.duration ? `${Math.round(result.duration / 1000)}s` : 'unknown',
      wasRetry: result.wasRetry,
      isRetryExhausted: result.isRetryExhausted,
      originalError: result.originalError,
    });
    process.exit(1);
  }
}

main();
