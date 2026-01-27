import { Page, Browser, CDPSession } from 'puppeteer';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { 
  setupDownloadDirectory, 
  waitForFile, 
  readFileToBuffer, 
  cleanupDownload 
} from '../utils/download.js';
import type { ExportResult } from '../types.js';

const PACIFIC_TRACK_LOGIN_URL = 'https://vtx.pacifictrack.com/login';
const PACIFIC_TRACK_VEHICLES_URL = 'https://vtx.pacifictrack.com/carb/vehicles?page=1&limit=100';
const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

/**
 * Custom error class for Pacific Track operations
 */
export class PacificTrackError extends Error {
  category: 'login' | 'navigation' | 'export';
  
  constructor(message: string, category: 'login' | 'navigation' | 'export') {
    super(message);
    this.name = 'PacificTrackError';
    this.category = category;
  }
}

/**
 * Log into Pacific Track
 * 
 * @param page - Puppeteer page instance
 * @param runId - Run ID for log correlation
 * @returns true if login successful
 * @throws PacificTrackError if login fails
 */
export async function login(page: Page, runId: string): Promise<boolean> {
  logger.info('Starting Pacific Track login', { runId });
  
  try {
    // Navigate to login page
    logger.debug('Navigating to login page', { runId, url: PACIFIC_TRACK_LOGIN_URL });
    await page.goto(PACIFIC_TRACK_LOGIN_URL, { waitUntil: 'networkidle2' });
    
    // Wait for email input to be visible
    await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });
    
    // Find and fill email input
    const emailInput = await page.$('input[type="email"]') 
      || await page.$('input[name="email"]') 
      || await page.$('#email');
    
    if (!emailInput) {
      throw new PacificTrackError('Could not find email input field', 'login');
    }
    
    // Type email with human-like delay
    logger.debug('Entering credentials', { runId });
    await emailInput.type(config.PACIFIC_TRACK_EMAIL, { delay: 50 });
    
    // Find and fill password input
    const passwordInput = await page.$('input[type="password"]')
      || await page.$('input[name="password"]')
      || await page.$('#password');
    
    if (!passwordInput) {
      throw new PacificTrackError('Could not find password input field', 'login');
    }
    
    // Type password with human-like delay
    await passwordInput.type(config.PACIFIC_TRACK_PASSWORD, { delay: 50 });
    
    // Find login button/submit input
    const loginButton = await page.$('input[type="submit"]')
      || await page.$('button[type="submit"]')
      || await page.$('#login-btn');
    
    if (!loginButton) {
      throw new PacificTrackError('Could not find login button', 'login');
    }
    
    // Click the submit button and wait for navigation
    logger.debug('Submitting login form', { runId });
    await loginButton.click();
    
    // Wait for navigation
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
    } catch {
      logger.debug('Navigation timeout, checking page state', { runId });
    }
    
    // Give the page a moment to settle
    await new Promise(r => setTimeout(r, 1000));
    
    // Verify login success by checking URL changed from /login
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login')) {
      // Still on login page - check for error message
      const errorElement = await page.$('.alert-danger, .error-message, .login-error, .alert');
      let errorMessage = 'Login failed - still on login page';
      
      if (errorElement) {
        const errorText = await page.evaluate(el => el?.textContent, errorElement);
        if (errorText) {
          errorMessage = `Login failed: ${errorText.trim()}`;
        }
      }
      
      // Take screenshot of failed login
      try {
        const screenshotPath = path.join(SCREENSHOTS_DIR, `login-failed-${runId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.error('Login failed, screenshot saved', { runId, path: screenshotPath });
      } catch (screenshotError) {
        logger.warn('Failed to save login failure screenshot', { 
          runId, 
          error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
        });
      }
      
      throw new PacificTrackError(errorMessage, 'login');
    }
    
    logger.info('Login successful', { runId, url: currentUrl });
    return true;
    
  } catch (error) {
    // If it's already our error, re-throw
    if (error instanceof PacificTrackError) {
      throw error;
    }
    
    // Take screenshot for debugging
    try {
      const screenshotPath = path.join(SCREENSHOTS_DIR, `login-error-${runId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.error('Login error, screenshot saved', { runId, path: screenshotPath });
    } catch (screenshotError) {
      logger.warn('Failed to save login error screenshot', { 
        runId, 
        error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
      });
    }
    
    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new PacificTrackError(`Login failed: ${message}`, 'login');
  }
}

/**
 * Navigate to the vehicles page in Pacific Track
 * 
 * @param page - Puppeteer page instance
 * @param runId - Run ID for log correlation
 * @returns true if navigation successful
 * @throws PacificTrackError if navigation fails
 */
export async function navigateToVehicles(page: Page, runId: string): Promise<boolean> {
  logger.info('Navigating to vehicles page', { runId, url: PACIFIC_TRACK_VEHICLES_URL });
  
  try {
    // Navigate directly to the vehicles page
    await page.goto(PACIFIC_TRACK_VEHICLES_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for page to load - look for the Actions button or the table
    await page.waitForSelector('#single-button, table, .table', { timeout: 15000 });
    
    // Verify we're on the right page by checking URL or page content
    const currentUrl = page.url();
    
    if (!currentUrl.includes('/carb/vehicles')) {
      // Take screenshot for debugging
      try {
        const screenshotPath = path.join(SCREENSHOTS_DIR, `navigation-failed-${runId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.error('Navigation failed - unexpected URL', { runId, url: currentUrl, path: screenshotPath });
      } catch (screenshotError) {
        logger.warn('Failed to save navigation failure screenshot', { 
          runId, 
          error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
        });
      }
      
      throw new PacificTrackError(`Navigation failed: ended up at ${currentUrl} instead of vehicles page`, 'navigation');
    }
    
    // Check if the Actions button exists (confirms we're on the right page)
    const actionsButton = await page.$('#single-button');
    if (!actionsButton) {
      // Try alternative selectors
      const altButton = await page.$('button[id*="action"], .dropdown-toggle, button.btn-primary');
      if (!altButton) {
        const screenshotPath = path.join(SCREENSHOTS_DIR, `navigation-nobutton-${runId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.warn('Actions button not found, screenshot saved', { runId, path: screenshotPath });
      }
    }
    
    logger.info('Successfully navigated to vehicles page', { runId, url: currentUrl });
    return true;
    
  } catch (error) {
    // If it's already our error, re-throw
    if (error instanceof PacificTrackError) {
      throw error;
    }
    
    // Take screenshot for debugging
    try {
      const screenshotPath = path.join(SCREENSHOTS_DIR, `navigation-error-${runId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.error('Navigation error, screenshot saved', { runId, path: screenshotPath });
    } catch (screenshotError) {
      logger.warn('Failed to save navigation error screenshot', { 
        runId, 
        error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
      });
    }
    
    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new PacificTrackError(`Navigation failed: ${message}`, 'navigation');
  }
}

/**
 * Trigger the export from the vehicles page
 * 
 * @param page - Puppeteer page instance
 * @param runId - Run ID for log correlation
 * @returns true if export was triggered successfully
 * @throws PacificTrackError if export trigger fails
 */
export async function triggerExport(page: Page, runId: string): Promise<boolean> {
  logger.info('Triggering export', { runId });
  
  try {
    // Find and click the Actions button
    const actionsButton = await page.$('#single-button');
    
    if (!actionsButton) {
      // Try alternative selectors
      const altButton = await page.$('button[id*="action"], .dropdown-toggle');
      if (!altButton) {
        try {
          const screenshotPath = path.join(SCREENSHOTS_DIR, `export-nobutton-${runId}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          logger.error('Could not find Actions button, screenshot saved', { runId, path: screenshotPath });
        } catch (screenshotError) {
          logger.warn('Failed to save export button error screenshot', { 
            runId, 
            error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
          });
        }
        throw new PacificTrackError('Could not find Actions button', 'export');
      }
      await altButton.click();
    } else {
      await actionsButton.click();
    }
    
    logger.debug('Clicked Actions button, waiting for dropdown', { runId });
    
    // Wait for dropdown to appear
    await new Promise(r => setTimeout(r, 1000));
    
    // Take screenshot to see dropdown state
    const dropdownScreenshotPath = path.join(SCREENSHOTS_DIR, `dropdown-${runId}.png`);
    await page.screenshot({ path: dropdownScreenshotPath, fullPage: true });
    logger.debug('Dropdown screenshot saved', { runId, path: dropdownScreenshotPath });
    
    // Try finding Export element by evaluating the DOM
    const exportInfo = await page.evaluate(() => {
      const allElements = document.querySelectorAll('a, button, li, .dropdown-item, .dropdown-menu *');
      const matches: string[] = [];
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text.toLowerCase().includes('export')) {
          matches.push(`${el.tagName}: "${text}"`);
        }
      }
      return matches;
    });
    
    logger.debug('Found elements with "export" text', { runId, elements: exportInfo });
    
    // Try clicking via evaluate with more specific targeting
    // Priority: BUTTON > A (link) > LI > others
    const clicked = await page.evaluate(() => {
      // First, try to find a BUTTON with Export text (most likely the interactive element)
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        if (text === 'export' || text.startsWith('export')) {
          btn.click();
          return { clicked: true, element: `BUTTON: ${btn.textContent?.trim()}` };
        }
      }
      
      // Next, try anchor links in dropdown
      const links = document.querySelectorAll('.dropdown-menu a, a.dropdown-item');
      for (const link of links) {
        const text = link.textContent?.trim().toLowerCase() || '';
        if (text === 'export' || text.startsWith('export')) {
          (link as HTMLElement).click();
          return { clicked: true, element: `A: ${link.textContent?.trim()}` };
        }
      }
      
      // Try dropdown items
      const dropdownItems = document.querySelectorAll('.dropdown-menu li, .dropdown-item');
      for (const item of dropdownItems) {
        const text = item.textContent?.trim().toLowerCase() || '';
        if (text === 'export') {
          // Try clicking any nested button or link first
          const nestedBtn = item.querySelector('button, a');
          if (nestedBtn) {
            (nestedBtn as HTMLElement).click();
            return { clicked: true, element: `Nested ${nestedBtn.tagName}: ${nestedBtn.textContent?.trim()}` };
          }
          (item as HTMLElement).click();
          return { clicked: true, element: `LI: ${item.textContent?.trim()}` };
        }
      }
      
      return { clicked: false, element: null };
    });
    
    if (!clicked.clicked) {
      try {
        const screenshotPath = path.join(SCREENSHOTS_DIR, `export-noexport-${runId}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.error('Could not find Export option, screenshot saved', { runId, path: screenshotPath });
      } catch (screenshotError) {
        logger.warn('Failed to save export option error screenshot', { 
          runId, 
          error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
        });
      }
      throw new PacificTrackError('Could not find Export option in dropdown', 'export');
    }
    
    logger.debug('Clicked Export element', { runId, element: clicked.element });
    
    logger.info('Export triggered, waiting for download...', { runId });
    
    // Wait for export to process - take periodic screenshots
    await new Promise(r => setTimeout(r, 2000));
    
    // Take screenshot after click to see modal/progress state
    const postExportPath = path.join(SCREENSHOTS_DIR, `post-export-${runId}.png`);
    await page.screenshot({ path: postExportPath, fullPage: true });
    logger.debug('Post-export screenshot saved', { runId, path: postExportPath });
    
    return true;
    
  } catch (error) {
    // If it's already our error, re-throw
    if (error instanceof PacificTrackError) {
      throw error;
    }
    
    // Take screenshot for debugging
    try {
      const screenshotPath = path.join(SCREENSHOTS_DIR, `export-error-${runId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.error('Export trigger error, screenshot saved', { runId, path: screenshotPath });
    } catch (screenshotError) {
      logger.warn('Failed to save export error screenshot', { 
        runId, 
        error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
      });
    }
    
    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new PacificTrackError(`Export trigger failed: ${message}`, 'export');
  }
}

/**
 * Set up download behavior for a page using CDP
 * 
 * @param page - Puppeteer page instance
 * @param downloadPath - Path where downloads should be saved
 * @param runId - Run ID for log correlation
 * @returns CDP session for cleanup
 */
export async function setupDownloadBehavior(
  page: Page, 
  downloadPath: string, 
  runId: string
): Promise<CDPSession> {
  logger.debug('Setting up download behavior', { runId, downloadPath });
  
  // Create a CDP session
  const client = await page.createCDPSession();
  
  // Enable the Fetch domain to handle downloads
  await client.send('Fetch.enable', {
    patterns: [{ requestStage: 'Response' }]
  });
  
  // Set download path using Browser domain
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath,
    eventsEnabled: true,
  });
  
  // Listen for download events
  client.on('Browser.downloadWillBegin', (params: { guid: string; suggestedFilename: string }) => {
    logger.info('Download starting', { 
      runId, 
      filename: params.suggestedFilename,
      guid: params.guid
    });
  });
  
  client.on('Browser.downloadProgress', (params: { guid: string; state: string; receivedBytes: number; totalBytes: number }) => {
    if (params.state === 'completed') {
      logger.info('Download completed', { 
        runId, 
        guid: params.guid,
        receivedBytes: params.receivedBytes,
        totalBytes: params.totalBytes
      });
    } else if (params.state === 'canceled') {
      logger.warn('Download canceled', { runId, guid: params.guid });
    }
  });
  
  // Disable Fetch interception (we just wanted the events)
  await client.send('Fetch.disable');
  
  logger.debug('Download behavior configured', { runId });
  
  return client;
}

/**
 * Wait for download to complete and capture the file
 * 
 * Polls the download directory for the XLSX file to appear.
 * 
 * @param page - Puppeteer page instance
 * @param downloadPath - Path where download directory is
 * @param runId - Run ID for log correlation
 * @param timeout - Maximum time to wait in milliseconds (default: 60000)
 * @returns ExportResult with buffer, filename, and size
 * @throws PacificTrackError if download fails or times out
 */
export async function waitForDownload(
  page: Page,
  downloadPath: string,
  runId: string,
  timeout: number = 60000
): Promise<ExportResult> {
  logger.info('Waiting for download to complete', { runId, timeout, downloadPath });
  
  try {
    // Wait for the XLSX file to appear in the download directory
    const filePath = await waitForFile(downloadPath, timeout);
    
    // Read file into buffer
    const { buffer, filename } = readFileToBuffer(filePath);
    const size = buffer.length;
    
    // Verify it's a valid XLSX file (starts with PK for ZIP format)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
      throw new PacificTrackError('Downloaded file is not a valid XLSX (ZIP) format', 'export');
    }
    
    logger.info('Download complete', { 
      runId, 
      filename, 
      size,
      sizeKB: Math.round(size / 1024)
    });
    
    // Clean up the downloaded file
    cleanupDownload(filePath);
    logger.debug('Cleaned up temporary download file', { runId });
    
    return { buffer, filename, size };
    
  } catch (error) {
    // If it's already our error, re-throw
    if (error instanceof PacificTrackError) {
      throw error;
    }
    
    // Take screenshot for debugging
    try {
      const screenshotPath = path.join(SCREENSHOTS_DIR, `download-error-${runId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.error('Download error, screenshot saved', { runId, path: screenshotPath });
    } catch (screenshotError) {
      logger.warn('Failed to save error screenshot', { 
        runId, 
        error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
      });
    }
    
    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new PacificTrackError(`Download failed: ${message}`, 'export');
  }
}
