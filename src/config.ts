import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  // Pacific Track credentials
  PACIFIC_TRACK_EMAIL: string;
  PACIFIC_TRACK_PASSWORD: string;

  // Supabase configuration
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  // Service account for API authentication
  SERVICE_ACCOUNT_EMAIL: string;
  SERVICE_ACCOUNT_PASSWORD: string;

  // VTX Uploads API
  VTX_UPLOADS_API_URL: string;

  // Notifications
  ALERT_EMAIL: string;

  // Runtime configuration
  NODE_ENV: string;
  SYNC_DELAY_MAX_MS: number;
  USER_AGENT: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createConfig(): Config {
  const isDev = process.env.NODE_ENV !== 'production';

  // In development, allow missing required vars with placeholder values
  const getVar = (name: string, defaultValue?: string): string => {
    if (isDev) {
      return process.env[name] ?? defaultValue ?? `<${name}_NOT_SET>`;
    }
    return getEnvVar(name, defaultValue);
  };

  return {
    // Pacific Track credentials
    PACIFIC_TRACK_EMAIL: getVar('PACIFIC_TRACK_EMAIL'),
    PACIFIC_TRACK_PASSWORD: getVar('PACIFIC_TRACK_PASSWORD'),

    // Supabase configuration
    SUPABASE_URL: getVar('SUPABASE_URL'),
    SUPABASE_SERVICE_KEY: getVar('SUPABASE_SERVICE_KEY'),

    // Service account for API authentication
    SERVICE_ACCOUNT_EMAIL: getVar('SERVICE_ACCOUNT_EMAIL'),
    SERVICE_ACCOUNT_PASSWORD: getVar('SERVICE_ACCOUNT_PASSWORD'),

    // VTX Uploads API
    VTX_UPLOADS_API_URL: getVar('VTX_UPLOADS_API_URL', 'https://vtx-uploads-production.up.railway.app'),

    // Notifications
    ALERT_EMAIL: getVar('ALERT_EMAIL', 'team@smartctc.com'),

    // Runtime configuration
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    SYNC_DELAY_MAX_MS: parseInt(process.env.SYNC_DELAY_MAX_MS ?? '60000', 10),
    USER_AGENT: process.env.USER_AGENT ?? 'CleanTruckCheckPro-Sync/1.0 (automated; contact: team@smartctc.com)',
  };
}

export const config = createConfig();
