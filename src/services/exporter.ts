import path from 'path';
import { launchBrowser, closeBrowser, createPage } from './browser.js';
import { 
  login, 
  navigateToVehicles, 
  triggerExport, 
  setupDownloadBehavior,
  waitForDownload 
} from './pacificTrack.js';
import { logger } from '../utils/logger.js';
import { setupDownloadDirectory, cleanupDownloadDirectory } from '../utils/download.js';
import type { ExportResult } from '../types.js';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
const DOWNLOAD_TIMEOUT_MS = 60000; // 60 seconds timeout for download

/**
 * Export vehicle data from Pacific Track
 * 
 * This function:
 * - Launches a headless browser
 * - Logs into Pacific Track
 * - Navigates to the vehicles page
 * - Triggers the export
 * - Captures the downloaded XLSX file
 * - Closes the browser
 * 
 * @param runId - Unique run ID for log correlation
 * @returns ExportResult with the file buffer, filename, and size
 */
export async function exportFromPacificTrack(runId: string): Promise<ExportResult> {
  logger.info('Starting Pacific Track export', { runId });
  
  // Set up download directory before launching browser
  const downloadPath = setupDownloadDirectory(runId);
  logger.debug('Download directory ready', { runId, downloadPath });
  
  const browser = await launchBrowser(runId);
  
  try {
    const page = await createPage(browser, runId);
    
    // Set up download behavior BEFORE triggering export
    await setupDownloadBehavior(page, downloadPath, runId);
    
    // Step 1: Login to Pacific Track
    await login(page, runId);
    
    // Take a screenshot of the dashboard (for debugging)
    const dashboardScreenshotPath = path.join(SCREENSHOTS_DIR, `dashboard-${runId}.png`);
    await page.screenshot({ path: dashboardScreenshotPath, fullPage: true });
    logger.debug('Dashboard screenshot saved', { runId, path: dashboardScreenshotPath });
    
    // Step 2: Navigate to vehicles page
    await navigateToVehicles(page, runId);
    
    // Take a screenshot of the vehicles page (for debugging)
    const vehiclesScreenshotPath = path.join(SCREENSHOTS_DIR, `vehicles-${runId}.png`);
    await page.screenshot({ path: vehiclesScreenshotPath, fullPage: true });
    logger.debug('Vehicles page screenshot saved', { runId, path: vehiclesScreenshotPath });
    
    // Step 3: Trigger the export
    await triggerExport(page, runId);
    
    // Take a screenshot after export trigger (for debugging)
    const exportScreenshotPath = path.join(SCREENSHOTS_DIR, `export-triggered-${runId}.png`);
    await page.screenshot({ path: exportScreenshotPath, fullPage: true });
    logger.debug('Export triggered screenshot saved', { runId, path: exportScreenshotPath });
    
    // Step 4: Wait for download to complete and capture the file
    const exportResult = await waitForDownload(page, downloadPath, runId, DOWNLOAD_TIMEOUT_MS);
    
    logger.info('Export completed successfully', { 
      runId, 
      filename: exportResult.filename,
      size: exportResult.size,
      sizeKB: Math.round(exportResult.size / 1024)
    });
    
    return exportResult;
    
  } finally {
    // Always close the browser, even if an error occurred
    await closeBrowser(browser, runId);
    
    // Clean up the download directory
    cleanupDownloadDirectory(downloadPath);
    logger.debug('Cleaned up download directory', { runId });
  }
}
