import { Page } from 'puppeteer';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const PACIFIC_TRACK_LOGIN_URL = 'https://vtx.pacifictrack.com/login';
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
      const screenshotPath = path.join(SCREENSHOTS_DIR, `login-failed-${runId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logger.error('Login failed, screenshot saved', { runId, path: screenshotPath });
      
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
    } catch {
      // Ignore screenshot errors
    }
    
    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new PacificTrackError(`Login failed: ${message}`, 'login');
  }
}
