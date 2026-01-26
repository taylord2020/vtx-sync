import path from 'path';
import { launchBrowser, closeBrowser, createPage } from './browser.js';
import { login } from './pacificTrack.js';
import { logger } from '../utils/logger.js';
import type { ExportResult } from '../types.js';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

/**
 * Export vehicle data from Pacific Track
 * 
 * Current implementation:
 * - Launches a browser
 * - Logs into Pacific Track
 * - Takes a screenshot of the dashboard
 * - Closes the browser
 * 
 * Full export implementation will be added in subsequent steps.
 */
export async function exportFromPacificTrack(runId: string): Promise<ExportResult | null> {
  logger.info('Starting Pacific Track export', { runId });
  
  const browser = await launchBrowser(runId);
  
  try {
    const page = await createPage(browser, runId);
    
    // Step 1: Login to Pacific Track
    await login(page, runId);
    
    // Take a screenshot of the dashboard (for debugging)
    const screenshotPath = path.join(SCREENSHOTS_DIR, `dashboard-${runId}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logger.info('Dashboard screenshot saved', { runId, path: screenshotPath });
    
    // Skeleton: Return null for now (will return file buffer in later steps)
    logger.info('Export complete (skeleton - login only)', { runId });
    return null;
    
  } finally {
    // Always close the browser, even if an error occurred
    await closeBrowser(browser, runId);
  }
}
