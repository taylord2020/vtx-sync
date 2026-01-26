/**
 * TypeScript interfaces for the VTX Sync Service
 */

/**
 * Sync result returned after a sync operation completes
 */
export interface SyncResult {
  success: boolean;
  runId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  phase?: 'login' | 'export' | 'upload' | 'complete';
  error?: string;
  errorCategory?: 'login' | 'navigation' | 'export' | 'upload' | 'auth';
  filename?: string;
  fileSize?: number;
  newRecords?: number;
  duplicates?: number;
  totalRows?: number;
}

/**
 * Result from exporting data from Pacific Track
 */
export interface ExportResult {
  buffer: Buffer;
  filename: string;
  size: number;
}

/**
 * Result from uploading to VTX Uploads API
 */
export interface UploadResult {
  success: boolean;
  importId?: string;
  newRecords?: number;
  duplicates?: number;
  totalRows?: number;
  skipped?: boolean;
  reason?: string;
}

/**
 * Log entry structure for JSON logging
 */
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  runId?: string;
  [key: string]: unknown;
}
