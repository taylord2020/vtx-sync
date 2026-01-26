import { config } from '../config.js';
import type { LogEntry } from '../types.js';

/**
 * Generate a unique run ID for correlating logs within a sync run
 * @returns 8-character random string
 */
export function generateRunId(): string {
  return Math.random().toString(36).substring(2, 10);
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  runId?: string;
  [key: string]: unknown;
}

/**
 * Format a log entry for development (human-readable)
 */
function formatDevLog(entry: LogEntry): string {
  const { timestamp, level, message, runId, ...rest } = entry;
  const time = new Date(timestamp).toLocaleTimeString();
  const runIdStr = runId ? ` [${runId}]` : '';
  const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  
  const levelColors: Record<LogLevel, string> = {
    info: '\x1b[36m',    // cyan
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    debug: '\x1b[90m',   // gray
  };
  const reset = '\x1b[0m';
  const color = levelColors[level as LogLevel] || '';
  
  return `${color}[${time}] ${level.toUpperCase()}${runIdStr}:${reset} ${message}${extras}`;
}

/**
 * Format a log entry for production (JSON)
 */
function formatProdLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Create a log entry and output it
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const formatted = config.NODE_ENV === 'production' 
    ? formatProdLog(entry) 
    : formatDevLog(entry);

  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

/**
 * Structured logger for the VTX Sync Service
 * 
 * In production: outputs JSON for easy parsing
 * In development: outputs human-readable formatted logs
 */
export const logger = {
  /**
   * Log an informational message
   */
  info(message: string, context?: LogContext): void {
    log('info', message, context);
  },

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    log('warn', message, context);
  },

  /**
   * Log an error message
   */
  error(message: string, context?: LogContext): void {
    log('error', message, context);
  },

  /**
   * Log a debug message (only shown in development or when DEBUG is set)
   */
  debug(message: string, context?: LogContext): void {
    if (config.NODE_ENV === 'development' || process.env.DEBUG) {
      log('debug', message, context);
    }
  },
};
