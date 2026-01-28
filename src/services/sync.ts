/**
 * Complete sync flow orchestrator
 * Coordinates export, authentication, and upload phases
 */

import { exportFromPacificTrack } from './exporter.js';
import { authenticateSupabase, uploadToVtxUploads } from './api.js';
import { logger } from '../utils/logger.js';
import type { SyncResult } from '../types.js';

/**
 * Run the complete sync process
 * 
 * This function orchestrates the three phases:
 * 1. Export from Pacific Track
 * 2. Authenticate with Supabase
 * 3. Upload to VTX Uploads API
 * 
 * @param runId - Unique identifier for this sync run
 * @returns SyncResult with success status and statistics
 */
export async function runSync(runId: string): Promise<SyncResult> {
  const startTime = new Date();
  
  logger.info('Sync started', { runId });

  try {
    // Phase 1: Export from Pacific Track
    logger.info('Phase 1: Exporting from Pacific Track', { runId });
    const exportResult = await exportFromPacificTrack(runId);
    
    logger.info('Export phase completed', {
      runId,
      filename: exportResult.filename,
      fileSize: exportResult.size,
    });

    // Phase 2: Authenticate with Supabase
    logger.info('Phase 2: Authenticating with Supabase', { runId });
    const token = await authenticateSupabase(runId);
    
    logger.info('Authentication phase completed', { runId });

    // Phase 3: Upload to VTX Uploads API
    logger.info('Phase 3: Uploading to VTX Uploads API', { runId });
    const uploadResult = await uploadToVtxUploads(
      exportResult.buffer,
      exportResult.filename,
      token,
      runId
    );

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Build success result
    const result: SyncResult = {
      success: true,
      runId,
      startTime,
      endTime,
      duration,
      phase: 'complete',
      filename: exportResult.filename,
      fileSize: exportResult.size,
      newRecords: uploadResult.newRecords,
      duplicates: uploadResult.duplicates,
      totalRows: uploadResult.totalRows,
    };

    if (uploadResult.skipped) {
      logger.info('Sync completed successfully (upload skipped: duplicate filename)', {
        runId,
        duration: `${Math.round(duration / 1000)}s`,
        reason: uploadResult.reason,
      });
    } else {
      logger.info('Sync completed successfully', {
        runId,
        duration: `${Math.round(duration / 1000)}s`,
        newRecords: result.newRecords,
        duplicates: result.duplicates,
        totalRows: result.totalRows,
      });
    }

    // Note: Success and failure emails are sent from index.ts and scheduler.ts
    // after retry logic completes, to ensure we only send one email per sync run

    return result;

  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCategory = (error as any).category as SyncResult['errorCategory'];
    
    // Determine phase based on error category
    let phase: SyncResult['phase'] = 'complete';
    if (errorCategory === 'login' || errorCategory === 'navigation' || errorCategory === 'export') {
      phase = 'export';
    } else if (errorCategory === 'auth' || errorCategory === 'upload') {
      phase = 'upload';
    }

    const result: SyncResult = {
      success: false,
      runId,
      startTime,
      endTime,
      duration,
      phase,
      error: errorMessage,
      errorCategory,
    };

    logger.error('Sync failed', {
      runId,
      phase,
      errorCategory,
      error: errorMessage,
      duration: `${Math.round(duration / 1000)}s`,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Note: Failure emails are sent from index.ts and scheduler.ts after retry logic completes
    // This ensures we only send emails when retry is exhausted, not on initial failures

    return result;
  }
}
