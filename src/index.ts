// Load environment variables FIRST, before any other imports
import 'dotenv/config';

import { config } from './config.js';
import { logger, generateRunId } from './utils/logger.js';
import { runSyncWithRetry } from './services/retry.js';
import { sendFailureAlert } from './services/notifier.js';
import { startScheduler } from './scheduler.js';
import { startHealthcheckServer, updateLastRun } from './utils/healthcheck.js';

/**
 * Run a single sync and exit
 */
async function runSingleSync(): Promise<void> {
  const runId = generateRunId();

  logger.info('VTX Sync Service starting (single run mode)...', { runId });
  logger.debug(`Environment: ${config.NODE_ENV}`, { runId });

  const result = await runSyncWithRetry(runId);

  // Update healthcheck tracking
  updateLastRun(result);

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

    // Send failure alert if retry is exhausted
    if (result.isRetryExhausted) {
      try {
        await sendFailureAlert(result);
        logger.info('Failure alert sent (or logged)', { runId: result.runId });
      } catch (alertError) {
        // Don't fail the process if alert sending fails
        logger.error('Failed to send failure alert', {
          runId: result.runId,
          error: alertError instanceof Error ? alertError.message : String(alertError),
        });
      }
    }

    process.exit(1);
  }
}

/**
 * Start the scheduler and keep process alive
 */
function runScheduler(): void {
  logger.info('VTX Sync Service starting (scheduler mode)...');
  logger.debug(`Environment: ${config.NODE_ENV}`);

  // Start healthcheck server
  const healthcheckServer = startHealthcheckServer(config.PORT);

  // Start the cron scheduler
  const cronJob = startScheduler();

  // Handle graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    cronJob.stop();
    healthcheckServer.close(() => {
      logger.info('Healthcheck server stopped');
      logger.info('Scheduler stopped');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Keep process alive
  logger.info('Scheduler is running. Press Ctrl+C to stop.');
}

async function main() {
  // Check if running in single-run mode
  // --once flag or NODE_ENV=development triggers single run
  const isSingleRun = process.argv.includes('--once') || config.NODE_ENV === 'development';

  if (isSingleRun) {
    await runSingleSync();
  } else {
    runScheduler();
  }
}

main();
