/**
 * Test script to run a single sync manually
 * Usage: pnpm tsx src/scripts/testRun.ts
 */

// Load environment variables FIRST
import 'dotenv/config';

import { logger, generateRunId } from '../utils/logger.js';
import { runSyncWithRetry } from '../services/retry.js';
import { sendFailureAlert } from '../services/notifier.js';
import { updateLastRun } from '../utils/healthcheck.js';

async function main() {
  const runId = generateRunId();

  logger.info('Manual test run starting...', { runId });

  try {
    const result = await runSyncWithRetry(runId);

    // Update healthcheck tracking
    updateLastRun(result);

    if (result.success) {
      const retryNote = result.wasRetry ? ' (succeeded on retry)' : '';
      logger.info(`Test run completed successfully${retryNote}`, {
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
      logger.error(`Test run failed${retryNote}`, {
        runId: result.runId,
        phase: result.phase,
        errorCategory: result.errorCategory,
        error: result.error,
        duration: result.duration ? `${Math.round(result.duration / 1000)}s` : 'unknown',
        wasRetry: result.wasRetry,
        isRetryExhausted: result.isRetryExhausted,
        originalError: result.originalError,
      });

      // Send failure alert if retry is exhausted
      if (result.isRetryExhausted) {
        try {
          await sendFailureAlert(result);
          logger.info('Failure alert sent (or logged)', { runId: result.runId });
        } catch (alertError) {
          logger.error('Failed to send failure alert', {
            runId: result.runId,
            error: alertError instanceof Error ? alertError.message : String(alertError),
          });
        }
      }

      process.exit(1);
    }
  } catch (error) {
    logger.error('Unexpected error in test run', {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

main();
