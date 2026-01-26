import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Launch a new Puppeteer browser instance configured for Railway deployment
 */
export async function launchBrowser(runId?: string): Promise<Browser> {
  logger.info('Launching browser...', { runId });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--window-size=1280,800',
    ],
    defaultViewport: {
      width: 1280,
      height: 800,
    },
    timeout: 30000,
    // Use system Chromium if PUPPETEER_EXECUTABLE_PATH is set (for Docker/Railway)
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    }),
  });

  logger.info('Browser launched successfully', { runId });
  return browser;
}

/**
 * Safely close a browser instance
 * Handles errors gracefully if browser is already closed
 */
export async function closeBrowser(browser: Browser, runId?: string): Promise<void> {
  try {
    if (browser && browser.connected) {
      await browser.close();
      logger.info('Browser closed successfully', { runId });
    } else {
      logger.debug('Browser already closed or disconnected', { runId });
    }
  } catch (error) {
    // Don't throw if browser is already closed
    logger.warn('Error closing browser (may already be closed)', {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Create a new page with custom user agent
 */
export async function createPage(browser: Browser, runId?: string): Promise<Page> {
  const page = await browser.newPage();
  
  // Set custom user agent to identify the automation
  await page.setUserAgent(config.USER_AGENT);
  
  // Set default navigation timeout
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(30000);

  logger.debug('Page created with custom user agent', { runId, userAgent: config.USER_AGENT });
  
  return page;
}
