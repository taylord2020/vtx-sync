/**
 * Retry logic for sync operations
 * Implements automatic retry with configurable delay
 */

import { runSync } from './sync.js';
import { logger, generateRunId } from '../utils/logger.js';
import { config } from '../config.js';
import type { SyncResult } from '../types.js';

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run sync with automatic retry on failure
 * 
 * If the initial sync fails, waits RETRY_DELAY_MS and retries once.
 * If the retry also fails, returns a result with isRetryExhausted: true.
 * 
 * @param runId - Unique identifier for this sync run
 * @returns SyncResult with retry information
 */
export async function runSyncWithRetry(runId: string): Promise<SyncResult> {
  logger.info('Starting sync with retry logic', { runId });

  // First attempt
  const firstResult = await runSync(runId);

  // If successful, return immediately
  if (firstResult.success) {
    logger.info('Sync succeeded on first attempt', { runId });
    return firstResult;
  }

  // First attempt failed - log and prepare for retry
  const retryDelaySeconds = Math.round(config.RETRY_DELAY_MS / 1000);
  logger.warn(`Sync failed, will retry in ${retryDelaySeconds} seconds`, {
    runId,
    delay: retryDelaySeconds,
    errorCategory: firstResult.errorCategory,
    error: firstResult.error,
    phase: firstResult.phase,
  });

  // Wait before retry
  await sleep(config.RETRY_DELAY_MS);

  // Generate new runId for retry
  const retryRunId = `${runId}-retry`;
  logger.info('Retrying sync', {
    originalRunId: runId,
    retryRunId,
  });

  // Retry attempt
  const retryResult = await runSync(retryRunId);

  // If retry succeeded
  if (retryResult.success) {
    logger.info('Sync succeeded on retry attempt', {
      originalRunId: runId,
      retryRunId,
    });

    return {
      ...retryResult,
      wasRetry: true,
      originalError: firstResult.error,
    };
  }

  // Retry also failed
  logger.error('Sync failed on retry attempt', {
    originalRunId: runId,
    retryRunId,
    originalError: firstResult.error,
    retryError: retryResult.error,
    errorCategory: retryResult.errorCategory,
    phase: retryResult.phase,
  });

  return {
    ...retryResult,
    wasRetry: true,
    isRetryExhausted: true,
    originalError: firstResult.error,
  };
}
