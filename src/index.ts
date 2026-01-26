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
    // Test the export functionality
    const result = await exportFromPacificTrack(runId);
    
    if (result) {
      logger.info('Export returned file', { runId, filename: result.filename, size: result.size });
    } else {
      logger.info('Export returned null (skeleton mode)', { runId });
    }
    
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
