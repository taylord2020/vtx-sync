// Load environment variables FIRST, before any other imports
import 'dotenv/config';

import { config } from './config.js';
import { logger, generateRunId } from './utils/logger.js';
import { exportFromPacificTrack } from './services/exporter.js';
import { authenticateSupabase, uploadToVtxUploads } from './services/api.js';

async function main() {
  const runId = generateRunId();

  logger.info('VTX Sync Service starting...', { runId });
  logger.debug(`Environment: ${config.NODE_ENV}`, { runId });

  try {
    // Phase 1: Export from Pacific Track
    const exportResult = await exportFromPacificTrack(runId);
    
    logger.info('Export completed', { 
      runId, 
      filename: exportResult.filename, 
      size: exportResult.size,
      sizeKB: Math.round(exportResult.size / 1024)
    });
    
    // Phase 2: Authenticate with Supabase
    const token = await authenticateSupabase(runId);
    
    // Phase 3: Upload to VTX Uploads API
    const uploadResult = await uploadToVtxUploads(
      exportResult.buffer,
      exportResult.filename,
      token,
      runId
    );
    
    if (uploadResult.skipped) {
      logger.info('Upload skipped (duplicate filename)', { runId, reason: uploadResult.reason });
    } else {
      logger.info('Upload completed', {
        runId,
        importId: uploadResult.importId,
        newRecords: uploadResult.newRecords,
        duplicates: uploadResult.duplicates,
        totalRows: uploadResult.totalRows,
      });
    }
    
    logger.info('VTX Sync Service completed successfully', { runId });
    process.exit(0);
  } catch (error) {
    logger.error('VTX Sync Service failed', {
      runId,
      error: error instanceof Error ? error.message : String(error),
      errorCategory: (error as any).category,
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

main();
