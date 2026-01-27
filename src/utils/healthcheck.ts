/**
 * Healthcheck HTTP server for monitoring sync service status
 * Provides /health endpoint with last run time and status
 */

import http from 'http';
import { logger } from './logger.js';
import { config } from '../config.js';
import { getNextRunTime } from '../scheduler.js';
import type { SyncResult } from '../types.js';

/**
 * Track the last sync run information
 */
let lastRunTime: Date | null = null;
let lastRunStatus: 'success' | 'failure' | null = null;
let lastRunResult: SyncResult | null = null;

/**
 * Update the last run information
 * @param result - The sync result to track
 */
export function updateLastRun(result: SyncResult): void {
  lastRunTime = result.endTime || new Date();
  lastRunStatus = result.success ? 'success' : 'failure';
  lastRunResult = result;
}

/**
 * Get health status response
 */
function getHealthStatus(): {
  status: 'ok' | 'degraded';
  lastRunTime: string | null;
  lastRunStatus: 'success' | 'failure' | null;
  nextRunTime: string;
  lastRunDetails?: {
    runId?: string;
    duration?: number;
    newRecords?: number;
    duplicates?: number;
    totalRows?: number;
    error?: string;
    errorCategory?: string;
  };
} {
  const nextRun = getNextRunTime();
  
  const response: {
    status: 'ok' | 'degraded';
    lastRunTime: string | null;
    lastRunStatus: 'success' | 'failure' | null;
    nextRunTime: string;
    lastRunDetails?: {
      runId?: string;
      duration?: number;
      newRecords?: number;
      duplicates?: number;
      totalRows?: number;
      error?: string;
      errorCategory?: string;
    };
  } = {
    status: lastRunStatus === 'failure' ? 'degraded' : 'ok',
    lastRunTime: lastRunTime ? lastRunTime.toISOString() : null,
    lastRunStatus,
    nextRunTime: nextRun.toISOString(),
  };

  // Include last run details if available
  if (lastRunResult) {
    response.lastRunDetails = {
      runId: lastRunResult.runId,
      duration: lastRunResult.duration,
      newRecords: lastRunResult.newRecords,
      duplicates: lastRunResult.duplicates,
      totalRows: lastRunResult.totalRows,
      error: lastRunResult.error,
      errorCategory: lastRunResult.errorCategory,
    };
  }

  return response;
}

/**
 * Create and start the healthcheck HTTP server
 * @param port - Port to listen on (default: 3000)
 * @returns The HTTP server instance
 */
export function startHealthcheckServer(port: number = 3000): http.Server {
  const server = http.createServer((req, res) => {
    // Only handle GET /health endpoint
    if (req.method === 'GET' && req.url === '/health') {
      const healthStatus = getHealthStatus();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthStatus, null, 2));
    } else {
      // 404 for other paths
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(port, () => {
    logger.info('Healthcheck server started', {
      port,
      endpoint: '/health',
    });
  });

  server.on('error', (error) => {
    logger.error('Healthcheck server error', {
      error: error.message,
      port,
    });
  });

  return server;
}
