/**
 * VTX Uploads API Client
 * Handles authentication with Supabase and uploading files to the VTX Uploads API
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { UploadResult } from '../types.js';

/**
 * Authenticate with Supabase using service account credentials
 * @param runId - Unique identifier for this sync run
 * @returns JWT access token
 * @throws Error with category "auth" on failure
 */
export async function authenticateSupabase(runId: string): Promise<string> {
  logger.info('Authenticating with Supabase...', { runId });

  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: config.SERVICE_ACCOUNT_EMAIL,
      password: config.SERVICE_ACCOUNT_PASSWORD,
    });

    if (error) {
      const authError = new Error(`Supabase authentication failed: ${error.message}`);
      (authError as any).category = 'auth';
      throw authError;
    }

    if (!data.session?.access_token) {
      const authError = new Error('Supabase authentication succeeded but no access token received');
      (authError as any).category = 'auth';
      throw authError;
    }

    logger.info('Supabase authentication successful', { 
      runId, 
      tokenLength: data.session.access_token.length 
    });

    return data.session.access_token;
  } catch (error) {
    // If it's already our error with category, re-throw
    if ((error as any).category === 'auth') {
      throw error;
    }

    // Wrap unknown errors
    const authError = new Error(
      `Supabase authentication error: ${error instanceof Error ? error.message : String(error)}`
    );
    (authError as any).category = 'auth';
    throw authError;
  }
}

/**
 * Upload XLSX file to VTX Uploads API
 * @param buffer - File content as Buffer
 * @param filename - Original filename
 * @param token - Supabase JWT access token
 * @param runId - Unique identifier for this sync run
 * @returns Upload result with statistics
 * @throws Error with category "upload" on failure
 */
export async function uploadToVtxUploads(
  buffer: Buffer,
  filename: string,
  token: string,
  runId: string
): Promise<UploadResult> {
  logger.info('Uploading to VTX Uploads API...', { runId, filename, size: buffer.length });

  try {
    const form = new FormData();
    form.append('file', buffer, {
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const response = await axios.post(
      `${config.VTX_UPLOADS_API_URL}/api/imports/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
        timeout: 60000, // 60 second timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const responseData = response.data;

    // Success response
    if (responseData.success) {
      const result: UploadResult = {
        success: true,
        importId: responseData.data?.import_id,
        newRecords: responseData.data?.inserted_rows ?? 0,
        duplicates: responseData.data?.skipped_rows ?? 0,
        totalRows: responseData.data?.total_rows ?? 0,
      };

      logger.info('Upload successful', {
        runId,
        importId: result.importId,
        newRecords: result.newRecords,
        duplicates: result.duplicates,
        totalRows: result.totalRows,
      });

      return result;
    }

    // Handle duplicate filename (not an error condition per PRD)
    if (responseData.code === 'DUPLICATE_FILENAME' || responseData.error === 'duplicate_filename') {
      logger.info('Upload skipped: duplicate filename', { runId, filename });
      return {
        success: true,
        skipped: true,
        reason: 'duplicate',
      };
    }

    // Other failure from API
    const uploadError = new Error(`VTX Uploads API error: ${responseData.error || 'Unknown error'}`);
    (uploadError as any).category = 'upload';
    throw uploadError;
  } catch (error) {
    // If it's already our error with category, re-throw
    if ((error as any).category === 'upload') {
      throw error;
    }

    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.error || error.message;

      // Check for duplicate filename in error response
      if (error.response?.data?.code === 'DUPLICATE_FILENAME') {
        logger.info('Upload skipped: duplicate filename', { runId, filename });
        return {
          success: true,
          skipped: true,
          reason: 'duplicate',
        };
      }

      const uploadError = new Error(
        `VTX Uploads API request failed (${statusCode || 'no status'}): ${errorMessage}`
      );
      (uploadError as any).category = 'upload';
      throw uploadError;
    }

    // Wrap unknown errors
    const uploadError = new Error(
      `VTX Uploads API error: ${error instanceof Error ? error.message : String(error)}`
    );
    (uploadError as any).category = 'upload';
    throw uploadError;
  }
}
