/**
 * Circuit breaker pattern to prevent excessive requests when something goes wrong
 * Opens the circuit after consecutive failures and auto-resets after a timeout
 */

import { logger } from './logger.js';

const CIRCUIT_BREAKER_THRESHOLD = 5; // Consecutive failures before opening circuit
const CIRCUIT_BREAKER_RESET_HOURS = 1; // Hours before auto-resetting

/**
 * In-memory state for circuit breaker
 */
let consecutiveFailures = 0;
let circuitOpenedAt: Date | null = null;

/**
 * Record a failure and potentially open the circuit
 */
export function recordFailure(): void {
  consecutiveFailures++;
  
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && circuitOpenedAt === null) {
    circuitOpenedAt = new Date();
    logger.warn(`Circuit breaker OPEN after ${consecutiveFailures} consecutive failures. Sync disabled for ${CIRCUIT_BREAKER_RESET_HOURS} hour(s).`, {
      consecutiveFailures,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
      resetHours: CIRCUIT_BREAKER_RESET_HOURS,
      openedAt: circuitOpenedAt.toISOString(),
    });
  }
}

/**
 * Record a success and reset the circuit if it was open
 */
export function recordSuccess(): void {
  const wasOpen = circuitOpenedAt !== null;
  
  consecutiveFailures = 0;
  circuitOpenedAt = null;
  
  if (wasOpen) {
    logger.info('Circuit breaker CLOSED. Sync resumed.', {
      consecutiveFailures: 0,
    });
  }
}

/**
 * Check if the circuit is currently open
 * Auto-resets if the reset timeout has passed
 * @returns true if circuit is open, false if closed
 */
export function isCircuitOpen(): boolean {
  // If we haven't hit the threshold, circuit is closed
  if (consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) {
    return false;
  }
  
  // If circuit was never opened, it's closed
  if (circuitOpenedAt === null) {
    return false;
  }
  
  // Check if reset timeout has passed
  const now = new Date();
  const resetTimeoutMs = CIRCUIT_BREAKER_RESET_HOURS * 60 * 60 * 1000;
  const timeSinceOpen = now.getTime() - circuitOpenedAt.getTime();
  
  if (timeSinceOpen >= resetTimeoutMs) {
    // Auto-reset the circuit
    logger.info('Circuit breaker auto-reset after timeout', {
      consecutiveFailures,
      resetHours: CIRCUIT_BREAKER_RESET_HOURS,
      timeSinceOpenMs: timeSinceOpen,
    });
    consecutiveFailures = 0;
    circuitOpenedAt = null;
    return false;
  }
  
  // Circuit is still open
  return true;
}

/**
 * Get current circuit breaker status
 * @returns Status object with circuit state information
 */
export function getStatus(): {
  isOpen: boolean;
  consecutiveFailures: number;
  openedAt: Date | null;
  willResetAt: Date | null;
} {
  const isOpen = isCircuitOpen();
  let willResetAt: Date | null = null;
  
  if (circuitOpenedAt !== null) {
    const resetTimeoutMs = CIRCUIT_BREAKER_RESET_HOURS * 60 * 60 * 1000;
    willResetAt = new Date(circuitOpenedAt.getTime() + resetTimeoutMs);
  }
  
  return {
    isOpen,
    consecutiveFailures,
    openedAt: circuitOpenedAt,
    willResetAt,
  };
}
