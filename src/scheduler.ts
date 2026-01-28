/**
 * Cron scheduler for automated sync execution
 * Runs sync every 30 minutes from 5:00 AM to 10:00 PM Pacific Time
 */

import cron from 'node-cron';
import { logger, generateRunId } from './utils/logger.js';
import { config } from './config.js';
import { runSyncWithRetry } from './services/retry.js';
import { sendFailureAlert } from './services/notifier.js';
import { sendSuccessEmail, sendFailureEmail } from './services/emailService.js';
import { isCircuitOpen, recordSuccess, recordFailure, getStatus } from './utils/circuitBreaker.js';
import { updateLastRun } from './utils/healthcheck.js';
import type { SyncResult } from './types.js';

/**
 * Flag to prevent overlapping sync runs
 */
let isRunning = false;

/**
 * Export last run information for healthcheck
 */
export let lastRunTime: Date | null = null;
export let lastRunStatus: 'success' | 'failure' | null = null;

/**
 * Get a random delay between 0 and SYNC_DELAY_MAX_MS
 * This spreads out requests to avoid predictable load patterns
 * @returns Random delay in milliseconds
 */
function getRandomDelay(): number {
  return Math.floor(Math.random() * config.SYNC_DELAY_MAX_MS);
}

/**
 * Calculate the next scheduled run time based on cron expression
 * @returns Date of next scheduled run
 */
export function getNextRunTime(): Date {
  // Cron: '0,30 5-22 * * *' (every 30 min, 5 AM - 10 PM)
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  
  let nextRun = new Date(pacificTime);
  
  // Get current hour and minute in Pacific Time
  const currentHour = nextRun.getHours();
  const currentMinute = nextRun.getMinutes();
  
  // If we're past 10 PM (22:00), schedule for 5 AM next day
  if (currentHour >= 22) {
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(5, 0, 0, 0);
    return nextRun;
  }
  
  // If we're before 5 AM, schedule for 5 AM today
  if (currentHour < 5) {
    nextRun.setHours(5, 0, 0, 0);
    return nextRun;
  }
  
  // We're in the active window (5 AM - 10 PM)
  // Find next 30-minute mark
  if (currentMinute < 30) {
    nextRun.setMinutes(30, 0, 0);
  } else {
    nextRun.setHours(nextRun.getHours() + 1);
    nextRun.setMinutes(0, 0, 0);
  }
  
  // If we went past 10 PM, schedule for 5 AM next day
  if (nextRun.getHours() >= 22) {
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(5, 0, 0, 0);
  }
  
  return nextRun;
}

/**
 * Start the cron scheduler
 * 
 * Creates a cron job that runs every 30 minutes from 5:00 AM to 10:00 PM Pacific Time.
 * Each run includes a random delay (0-60 seconds) to avoid predictable patterns.
 * 
 * @returns The cron job instance
 */
export function startScheduler(): cron.ScheduledTask {
  // Cron expression: every 30 minutes (0,30) from 5 AM to 10 PM (5-22), every day
  const cronExpression = '0,30 5-22 * * *';
  const timezone = 'America/Los_Angeles';

  // Calculate next run time before creating the task
  const nextRun = getNextRunTime();

  logger.info('Starting scheduler', {
    cronExpression,
    timezone,
    syncDelayMaxMs: config.SYNC_DELAY_MAX_MS,
    nextRunTime: nextRun.toISOString(),
    nextRunTimeLocal: nextRun.toLocaleString('en-US', { timeZone: timezone }),
  });

  const cronJob = cron.schedule(
    cronExpression,
    async () => {
      // Check if previous run is still in progress
      if (isRunning) {
        logger.warn('Skipping sync: previous run still in progress');
        return;
      }

      // Check if circuit breaker is open
      if (isCircuitOpen()) {
        const status = getStatus();
        logger.warn('Skipping sync: circuit breaker is open', {
          consecutiveFailures: status.consecutiveFailures,
          openedAt: status.openedAt?.toISOString(),
          willResetAt: status.willResetAt?.toISOString(),
        });
        return;
      }

      // Set running flag
      isRunning = true;
      const runId = generateRunId();

      try {
        // Calculate random delay
        const delayMs = getRandomDelay();
        const delaySeconds = Math.round(delayMs / 1000);
        
        logger.info('Scheduled sync triggered', {
          runId,
          delaySeconds,
        });

        // Wait for random delay
        if (delayMs > 0) {
          logger.info(`Waiting ${delaySeconds} seconds before sync`, { runId });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        // Run sync with retry
        const result = await runSyncWithRetry(runId);

        // Handle result
        if (result.success) {
          // Record success to reset circuit breaker
          recordSuccess();
          
          const retryNote = result.wasRetry ? ' (succeeded on retry)' : '';
          logger.info(`Scheduled sync completed successfully${retryNote}`, {
            runId: result.runId,
            duration: result.duration ? `${Math.round(result.duration / 1000)}s` : 'unknown',
            newRecords: result.newRecords,
            duplicates: result.duplicates,
            totalRows: result.totalRows,
            wasRetry: result.wasRetry,
          });

          // Send success email notification
          try {
            await sendSuccessEmail(result);
          } catch (emailError) {
            // Don't let email failures break the sync
            logger.error('Failed to send success email notification', {
              runId: result.runId,
              error: emailError instanceof Error ? emailError.message : String(emailError),
            });
          }
        } else {
          // Record failure for circuit breaker
          recordFailure();
          
          const retryNote = result.isRetryExhausted ? ' (retry exhausted)' : '';
          logger.error(`Scheduled sync failed${retryNote}`, {
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

            // Send failure email notification
            try {
              await sendFailureEmail(result);
            } catch (emailError) {
              // Don't let email failures break the sync
              logger.error('Failed to send failure email notification', {
                runId: result.runId,
                error: emailError instanceof Error ? emailError.message : String(emailError),
              });
            }
          }
        }

        // Update healthcheck tracking
        lastRunTime = result.endTime || new Date();
        lastRunStatus = result.success ? 'success' : 'failure';
        updateLastRun(result);
      } catch (error) {
        // Unexpected error in scheduler itself
        logger.error('Unexpected error in scheduled sync', {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        // Always reset running flag
        isRunning = false;
      }
    },
    {
      timezone,
    }
  );

  // The cron job is already started by default, but we can explicitly start it
  cronJob.start();

  logger.info('Scheduler is running', {
    cronExpression,
    timezone,
  });

  return cronJob;
}
