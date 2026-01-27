/**
 * Email notification service for sync failures
 * Sends alerts when sync fails after retry is exhausted
 */

import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { SyncResult } from '../types.js';

/**
 * Send failure alert email (or log for MVP)
 * 
 * Currently logs the alert message. Actual email sending can be implemented
 * later using Resend, Supabase Edge Function, or another email service.
 * 
 * @param result - Sync result with failure details
 */
export async function sendFailureAlert(result: SyncResult): Promise<void> {
  // Only send if retry is exhausted
  if (!result.isRetryExhausted) {
    logger.debug('Skipping alert - retry not exhausted', {
      runId: result.runId,
    });
    return;
  }

  const timestamp = result.endTime 
    ? result.endTime.toISOString() 
    : new Date().toISOString();

  // Format email content
  const emailContent = `VTX Sync Service - Failure Alert

Time: ${timestamp}
Run ID: ${result.runId}

Error Category: ${result.errorCategory || 'unknown'}
Error Message: ${result.error || 'Unknown error'}
Phase: ${result.phase || 'unknown'}

The sync will automatically retry at the next scheduled time.

---
VTX Sync Service`;

  // For MVP, log the alert instead of sending email
  // TODO: Implement actual email sending via Resend or Supabase Edge Function
  logger.warn('ALERT: Would send email to team@smartctc.com', {
    runId: result.runId,
    alertEmail: config.ALERT_EMAIL,
    emailContent,
  });

  // Log structured alert data for monitoring
  logger.error('Sync failure alert triggered', {
    runId: result.runId,
    timestamp,
    errorCategory: result.errorCategory,
    error: result.error,
    phase: result.phase,
    duration: result.duration ? `${Math.round(result.duration / 1000)}s` : 'unknown',
    originalError: result.originalError,
    alertEmail: config.ALERT_EMAIL,
  });
}
