import { config } from './config.js';
import { logger, generateRunId } from './utils/logger.js';

const runId = generateRunId();

logger.info('VTX Sync Service starting...', { runId });
logger.info(`Environment: ${config.NODE_ENV}`, { runId });
logger.debug('Debug logging is enabled', { runId });
