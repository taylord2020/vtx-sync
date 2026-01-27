// Load environment variables FIRST, before any other imports
import 'dotenv/config';

import { config } from './config.js';
import { logger, generateRunId } from './utils/logger.js';
import { exportFromPacificTrack } from './services/exporter.js';

async function main() {
  const runId = generateRunId();

  logger.info('VTX Sync Service starting...', { runId });
  logger.debug(`Environment: ${config.NODE_ENV}`, { runId });

  try {
    // Run the export from Pacific Track
    const result = await exportFromPacificTrack(runId);
    
    logger.info('Export completed', { 
      runId, 
      filename: result.filename, 
      size: result.size,
      sizeKB: Math.round(result.size / 1024)
    });
    
    // TODO: Step 7+ will add upload to VTX Uploads API
    
    logger.info('VTX Sync Service completed successfully', { runId });
    process.exit(0);
  } catch (error) {
    logger.error('VTX Sync Service failed', {
      runId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

main();
