/**
 * Email notification service using Resend
 * Sends success and failure notifications after each sync run
 */

import { Resend } from 'resend';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { SyncResult } from '../types.js';

let resendClient: Resend | null = null;

/**
 * Initialize Resend client if API key is available
 */
function getResendClient(): Resend | null {
  if (!config.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(config.RESEND_API_KEY);
  }

  return resendClient;
}

/**
 * Check if email notifications are enabled
 */
function isEmailEnabled(): boolean {
  if (!config.ENABLE_EMAIL_NOTIFICATIONS) {
    return false;
  }

  if (!config.RESEND_API_KEY) {
    logger.debug('Email notifications disabled: RESEND_API_KEY not set');
    return false;
  }

  return true;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms?: number): string {
  if (!ms) return 'unknown';
  
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Generate HTML email template with professional styling
 */
function generateEmailTemplate(
  title: string,
  content: string,
  isSuccess: boolean
): string {
  const backgroundColor = isSuccess ? '#f0f9ff' : '#fef2f2';
  const borderColor = isSuccess ? '#3b82f6' : '#ef4444';
  const titleColor = isSuccess ? '#1e40af' : '#991b1b';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${backgroundColor}; padding: 24px; border-bottom: 3px solid ${borderColor};">
              <h1 style="margin: 0; color: ${titleColor}; font-size: 24px; font-weight: 600;">${title}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 24px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
              <p style="margin: 0;">VTX Sync Service - Automated Vehicle Compliance Data Sync</p>
              <p style="margin: 4px 0 0 0;">Run ID: ${new Date().getTime()}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send success notification email after a successful sync
 * 
 * Sends an HTML-formatted email with sync statistics including:
 * - Duration
 * - Total rows processed
 * - New records added
 * - Duplicates skipped
 * - Timestamp
 * - Retry status (if applicable)
 * 
 * @param result - Sync result with success details
 * @returns Promise that resolves when email is sent (or skipped if disabled)
 */
export async function sendSuccessEmail(result: SyncResult): Promise<void> {
  if (!isEmailEnabled()) {
    logger.debug('Skipping success email - notifications disabled', {
      runId: result.runId,
    });
    return;
  }

  const client = getResendClient();
  if (!client) {
    logger.warn('Cannot send success email - Resend client not initialized', {
      runId: result.runId,
    });
    return;
  }

  const timestamp = result.endTime 
    ? result.endTime.toISOString() 
    : new Date().toISOString();
  
  const duration = formatDuration(result.duration);
  const timestampFormatted = new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const content = `
    <div style="line-height: 1.6; color: #1f2937;">
      <p style="margin: 0 0 16px 0; font-size: 16px;">The VTX sync completed successfully.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Sync Duration:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${duration}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Total Rows:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${result.totalRows ?? 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">New Records:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #10b981;">${result.newRecords ?? 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Duplicates:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">${result.duplicates ?? 0}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Timestamp:</td>
          <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px;">${timestampFormatted}</td>
        </tr>
      </table>
      
      ${result.wasRetry ? '<p style="margin: 16px 0 0 0; padding: 12px; background-color: #fef3c7; border-left: 4px solid #f59e0b; color: #92400e; font-size: 14px;"><strong>Note:</strong> This sync succeeded on retry after an initial failure.</p>' : ''}
    </div>
  `;

  const html = generateEmailTemplate('VTX Sync Completed Successfully', content, true);

  try {
    await client.emails.send({
      from: config.NOTIFICATION_EMAIL_FROM,
      to: config.NOTIFICATION_EMAIL_TO,
      subject: `VTX Sync Success - ${result.runId}`,
      html,
    });

    logger.info('Success email sent', {
      runId: result.runId,
      to: config.NOTIFICATION_EMAIL_TO,
    });
  } catch (error) {
    // Log error but don't throw - email failures shouldn't break the sync
    logger.error('Failed to send success email', {
      runId: result.runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Send failure notification email after sync fails with retry exhausted
 * 
 * Sends an HTML-formatted email with failure details including:
 * - Failed phase
 * - Error category
 * - Error message
 * - Duration
 * - Timestamp
 * - Retry exhaustion status
 * - Original error (if retry was attempted)
 * 
 * Only sends if retry is exhausted (isRetryExhausted: true).
 * 
 * @param result - Sync result with failure details
 * @returns Promise that resolves when email is sent (or skipped if disabled)
 */
export async function sendFailureEmail(result: SyncResult): Promise<void> {
  if (!isEmailEnabled()) {
    logger.debug('Skipping failure email - notifications disabled', {
      runId: result.runId,
    });
    return;
  }

  const client = getResendClient();
  if (!client) {
    logger.warn('Cannot send failure email - Resend client not initialized', {
      runId: result.runId,
    });
    return;
  }

  const timestamp = result.endTime 
    ? result.endTime.toISOString() 
    : new Date().toISOString();
  
  const duration = formatDuration(result.duration);
  const timestampFormatted = new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const phaseLabels: Record<string, string> = {
    login: 'Login',
    export: 'Export',
    upload: 'Upload',
    complete: 'Complete',
  };

  const phaseLabel = phaseLabels[result.phase || 'unknown'] || result.phase || 'Unknown';
  const errorCategory = result.errorCategory || 'unknown';

  const content = `
    <div style="line-height: 1.6; color: #1f2937;">
      <p style="margin: 0 0 16px 0; font-size: 16px; color: #991b1b;">The VTX sync failed after all retry attempts.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Failed Phase:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626; font-weight: 600;">${phaseLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Error Category:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${errorCategory}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Error Message:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937; word-break: break-word;">${result.error || 'Unknown error'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Duration:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${duration}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Timestamp:</td>
          <td style="padding: 8px 0; text-align: right; color: #1f2937; font-size: 14px;">${timestampFormatted}</td>
        </tr>
      </table>
      
      ${result.isRetryExhausted ? '<p style="margin: 16px 0 0 0; padding: 12px; background-color: #fee2e2; border-left: 4px solid #ef4444; color: #991b1b; font-size: 14px;"><strong>Retry Status:</strong> All retry attempts have been exhausted. The sync will automatically retry at the next scheduled time.</p>' : ''}
      
      ${result.originalError ? `<p style="margin: 16px 0 0 0; padding: 12px; background-color: #f3f4f6; border-left: 4px solid #6b7280; color: #374151; font-size: 14px;"><strong>Original Error:</strong> ${result.originalError}</p>` : ''}
    </div>
  `;

  const html = generateEmailTemplate('VTX Sync Failed', content, false);

  try {
    await client.emails.send({
      from: config.NOTIFICATION_EMAIL_FROM,
      to: config.NOTIFICATION_EMAIL_TO,
      subject: `VTX Sync Failed - ${errorCategory} (${result.runId})`,
      html,
    });

    logger.info('Failure email sent', {
      runId: result.runId,
      to: config.NOTIFICATION_EMAIL_TO,
      phase: result.phase,
      errorCategory,
    });
  } catch (error) {
    // Log error but don't throw - email failures shouldn't break the sync
    logger.error('Failed to send failure email', {
      runId: result.runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
