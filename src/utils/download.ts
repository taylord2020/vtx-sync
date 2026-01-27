import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from './logger.js';

/**
 * Set up a temporary download directory for capturing exports
 * 
 * @param runId - Run ID for unique directory naming
 * @returns Path to the created download directory
 */
export function setupDownloadDirectory(runId: string): string {
  const tempDir = path.join(os.tmpdir(), `vtx-sync-${runId}`);
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    logger.debug('Created download directory', { runId, path: tempDir });
  }
  
  return tempDir;
}

/**
 * Wait for an XLSX file to appear in the download directory
 * 
 * @param directory - Path to the download directory
 * @param timeout - Maximum time to wait in milliseconds (default: 60000)
 * @returns Full path to the downloaded file
 * @throws Error if timeout is reached before file appears
 */
export async function waitForFile(directory: string, timeout: number = 60000): Promise<string> {
  const pollInterval = 500; // Check every 500ms
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const files = fs.readdirSync(directory);
      
      // Look for .xlsx files that aren't temporary downloads
      const xlsxFiles = files.filter(f => 
        f.endsWith('.xlsx') && 
        !f.endsWith('.crdownload') && 
        !f.endsWith('.tmp') &&
        !f.startsWith('.')
      );
      
      if (xlsxFiles.length > 0) {
        const filePath = path.join(directory, xlsxFiles[0]);
        
        // Verify file is complete by checking it's not empty and can be read
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          // Additional check: wait a moment and verify size is stable (download complete)
          await new Promise(r => setTimeout(r, 200));
          const newStats = fs.statSync(filePath);
          
          if (newStats.size === stats.size) {
            return filePath;
          }
        }
      }
    } catch {
      // Directory might not exist yet or file might be in use
    }
    
    // Wait before next poll
    await new Promise(r => setTimeout(r, pollInterval));
  }
  
  throw new Error(`Timeout waiting for XLSX file in ${directory} after ${timeout}ms`);
}

/**
 * Read a file into a buffer and extract its filename
 * 
 * @param filePath - Full path to the file
 * @returns Object with buffer and filename
 */
export function readFileToBuffer(filePath: string): { buffer: Buffer; filename: string } {
  const buffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  
  return { buffer, filename };
}

/**
 * Clean up a downloaded file and its parent directory
 * 
 * @param filePath - Full path to the file to clean up
 */
export function cleanupDownload(filePath: string): void {
  try {
    // Delete the file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Try to remove the parent directory (only works if empty)
    const dirPath = path.dirname(filePath);
    if (fs.existsSync(dirPath)) {
      const remainingFiles = fs.readdirSync(dirPath);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(dirPath);
      }
    }
  } catch (error) {
    // Log but don't throw - cleanup is best-effort
    logger.debug('Cleanup warning', { 
      filePath, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Clean up a download directory completely
 * 
 * @param directory - Path to the download directory
 */
export function cleanupDownloadDirectory(directory: string): void {
  try {
    if (fs.existsSync(directory)) {
      // Remove all files in the directory
      const files = fs.readdirSync(directory);
      for (const file of files) {
        fs.unlinkSync(path.join(directory, file));
      }
      // Remove the directory
      fs.rmdirSync(directory);
    }
  } catch (error) {
    // Log but don't throw - cleanup is best-effort
    logger.debug('Directory cleanup warning', { 
      directory, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}
