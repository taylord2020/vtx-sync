# VTX Sync Service

Automated sync service that exports vehicle compliance data from Pacific Track and uploads it to VTX Uploads every 30 minutes during business hours.

## Overview

This service automates the manual process of:
1. Logging into Pacific Track (vtx.pacifictrack.com)
2. Navigating to the CTC OPS vehicles page
3. Exporting data as XLSX
4. Uploading the file to VTX Uploads (ctcops.smartctc.com)

The service runs on a scheduled basis (every 30 minutes from 5:00 AM to 10:00 PM Pacific Time) and includes:
- Automatic retry logic on failures
- Email notifications for failures
- Circuit breaker pattern to prevent excessive requests during outages
- Healthcheck endpoint for monitoring
- Comprehensive logging

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **Browser Automation**: Puppeteer
- **HTTP Client**: Axios
- **Scheduling**: node-cron
- **Email**: Resend (optional)
- **Hosting**: Railway

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Railway Platform                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────┐                           │
│  │         vtx-sync (new service)       │                           │
│  │                                      │                           │
│  │  ┌─────────────┐  ┌──────────────┐  │                           │
│  │  │ Cron        │  │ Puppeteer    │  │                           │
│  │  │ Scheduler   │──│ Browser      │──┼──────┐                    │
│  │  │ (node-cron) │  │ Automation   │  │      │                    │
│  │  └─────────────┘  └──────────────┘  │      │                    │
│  │                          │          │      │                    │
│  │                          ▼          │      │                    │
│  │                   ┌──────────────┐  │      │                    │
│  │                   │ File Buffer  │  │      │                    │
│  │                   │ (in memory)  │  │      │                    │
│  │                   └──────┬───────┘  │      │                    │
│  │                          │          │      │                    │
│  │                          ▼          │      │                    │
│  │                   ┌──────────────┐  │      │                    │
│  │                   │ API Client   │  │      │                    │
│  │                   │ (axios)      │──┼──┐   │                    │
│  │                   └──────────────┘  │  │   │                    │
│  │                          │          │  │   │                    │
│  │                          ▼          │  │   │                    │
│  │                   ┌──────────────┐  │  │   │                    │
│  │                   │ Email Alerts │  │  │   │                    │
│  │                   │ (Resend)    │  │  │   │                    │
│  │                   └──────────────┘  │  │   │                    │
│  │                                      │  │   │                    │
│  └──────────────────────────────────────┘  │   │                    │
│                                            │   │                    │
│  ┌──────────────────────────────────────┐  │   │                    │
│  │    vtx-uploads (existing backend)    │◄─┘   │                    │
│  │                                      │      │                    │
│  │    POST /api/imports/upload          │      │                    │
│  │                                      │      │                    │
│  └──────────────────────────────────────┘      │                    │
│                                                 │                    │
└─────────────────────────────────────────────────│────────────────────┘
                                                  │
                                                  ▼
                                    ┌───────────────────────┐
                                    │  vtx.pacifictrack.com │
                                    │                       │
                                    │  - Login page         │
                                    │  - CTC OPS dashboard  │
                                    │  - XLSX export        │
                                    │                       │
                                    └───────────────────────┘
```

## Prerequisites

- Node.js 20 or later
- pnpm package manager
- Pacific Track account credentials
- Supabase service account for VTX Uploads API
- (Optional) Resend API key for email notifications

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd vtx-sync
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

See the [Environment Variables](#environment-variables) section below for a complete list of required and optional variables.

**Important: Passwords with Special Characters**

If your password contains special characters (such as `&`, `#`, `!`, `@`, `*`, `$`, etc.):

- **For local development** (`.env` file): Wrap the password in quotes:
  ```
  SERVICE_ACCOUNT_PASSWORD="J&2Kr#v!@@N3K*AR"
  ```

- **For Railway production**: Do NOT use quotes - enter the raw password directly in the Railway environment variable UI:
  ```
  SERVICE_ACCOUNT_PASSWORD=J&2Kr#v!@@N3K*AR
  ```

Without quotes in local development, special characters may be interpreted by the shell or truncated, causing authentication failures.

## Running Locally

### Development mode (single run with watch)

```bash
pnpm dev
```

This runs a single sync and exits. Useful for testing changes.

**Note**: The cron scheduler is disabled by default (`ENABLE_CRON=false`) when running locally to prevent duplicate syncs while production is also running.

### Single run (production build)

```bash
pnpm build
pnpm start:once
```

### Scheduler mode (production)

```bash
pnpm build
pnpm start
```

This starts the cron scheduler and keeps the process running. Set `ENABLE_CRON=true` in your `.env` file to enable the scheduler.

### Test run script

```bash
pnpm test:run
```

Runs a single sync using the test script.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PACIFIC_TRACK_EMAIL` | Login email for Pacific Track | `user@company.com` |
| `PACIFIC_TRACK_PASSWORD` | Login password for Pacific Track | `•••••••••` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase anon key | `eyJhbG...` |
| `SERVICE_ACCOUNT_EMAIL` | Sync service Supabase user email | `vtx-sync@smartctc.com` |
| `SERVICE_ACCOUNT_PASSWORD` | Sync service Supabase user password | `•••••••••` |
| `VTX_UPLOADS_API_URL` | Backend API base URL | `https://vtx-uploads-production.up.railway.app` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALERT_EMAIL` | Email for failure notifications | `team@smartctc.com` |
| `TZ` | Timezone for cron schedule | `America/Los_Angeles` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Healthcheck server port | `3000` |
| `SYNC_DELAY_MAX_MS` | Max random delay before sync (ms) | `60000` (60 seconds) |
| `RETRY_DELAY_MS` | Delay before retry on failure (ms) | `300000` (5 minutes) |
| `USER_AGENT` | Browser user agent string | `CleanTruckCheckPro-Sync/1.0 (automated; contact: team@smartctc.com)` |
| `ENABLE_CRON` | Enable cron scheduler (`'true'` or `'false'`) | `false` |
| `RESEND_API_KEY` | Resend API key for email notifications | (not set) |
| `NOTIFICATION_EMAIL_TO` | Recipient email for notifications | `team@smartctc.com` |
| `NOTIFICATION_EMAIL_FROM` | Sender email for notifications | `vtx-sync@notifications.smartctc.com` |
| `ENABLE_EMAIL_NOTIFICATIONS` | Enable email notifications (`'true'` or `'false'`) | `false` |
| `HEADLESS` | Run browser in headless mode (`'false'` to show browser) | `true` |

## Schedule

The service runs every 30 minutes from 5:00 AM to 10:00 PM Pacific Time, 7 days a week.

- **Cron expression**: `0,30 5-22 * * *`
- **Total runs per day**: 36 (5:00, 5:30, 6:00... 21:30, 22:00)
- **Timezone**: America/Los_Angeles (PST/PDT)

If a sync is still in progress when the next scheduled time arrives, the new run is skipped and a warning is logged.

## Features

### Automatic Retry

- On any failure, the service waits 5 minutes (configurable via `RETRY_DELAY_MS`) and retries once
- If the retry succeeds, no alert email is sent
- If the retry also fails, an alert email is sent (if enabled)

### Circuit Breaker

- Tracks consecutive sync failures in memory
- After 5 consecutive failures, the circuit breaker opens
- When open, syncs are disabled for 1 hour to prevent server overload
- Circuit breaker auto-resets after the timeout period
- Successful sync immediately closes the circuit and resets the failure count

### Email Notifications

- Success emails: Sent after every successful sync (if enabled)
- Failure emails: Sent only when retry is exhausted (if enabled)
- Requires `RESEND_API_KEY` and `ENABLE_EMAIL_NOTIFICATIONS=true`
- Professional HTML formatting with detailed statistics

### Healthcheck Endpoint

- Exposes `/health` endpoint on port 3000 (configurable via `PORT`)
- Returns JSON with service status, last run time, last run status, and next scheduled run time
- Useful for monitoring and Railway health checks

### Logging

- Structured JSON logging in production
- Human-readable logging in development
- All logs include runId for correlation
- Logs include timestamps, levels, and contextual data

## Railway Deployment

### Prerequisites

1. Railway account (sign up at [railway.app](https://railway.app))
2. Git repository connected to Railway
3. All required environment variables configured

### Deployment Steps

1. **Create Railway Service**:
   - Go to Railway dashboard
   - Create new project or add to existing project
   - Connect your Git repository
   - Railway will automatically detect the Dockerfile

2. **Configure Environment Variables**:
   Add all required environment variables in Railway dashboard (see [Environment Variables](#environment-variables) section).
   
   **Important**: If your `SERVICE_ACCOUNT_PASSWORD` contains special characters, enter the raw password directly in Railway's UI (do NOT wrap in quotes).

3. **Deploy**:
   - Railway will automatically build and deploy on push to main branch
   - Or trigger manual deploy from Railway dashboard
   - Watch build logs for any errors

4. **Verify Deployment**:
   - Check logs show "Scheduler started" message
   - Verify timezone is set to America/Los_Angeles
   - Set `ENABLE_CRON=true` to enable the scheduler
   - Wait for first scheduled run (or check logs)
   - Verify sync completes successfully
   - Check VTX Uploads for new import records

### Docker Build

The service uses a custom Dockerfile optimized for Puppeteer:

- Uses `node:20-slim` base image
- Installs Chromium and required dependencies
- Sets `PUPPETEER_EXECUTABLE_PATH` to use system Chromium
- Builds TypeScript and runs production code

To test Docker build locally:

```bash
# Build image
docker build -t vtx-sync .

# Run container (with .env file)
docker run --env-file .env vtx-sync

# Or run with environment variables
docker run \
  -e PACIFIC_TRACK_EMAIL=... \
  -e PACIFIC_TRACK_PASSWORD=... \
  -e ENABLE_CRON=true \
  # ... other env vars
  vtx-sync
```

### Monitoring

- **Logs**: View real-time logs in Railway dashboard
- **Healthcheck**: Service exposes `/health` endpoint (port 3000)
- **Alerts**: Email notifications sent on sync failures (after retry exhausted, if enabled)

## Troubleshooting

### Service won't start

- Check Railway logs for build errors
- Verify all required environment variables are set
- Ensure Dockerfile builds successfully
- Check that `NODE_ENV=production` is set in Railway

### Chromium not found

- Verify `PUPPETEER_EXECUTABLE_PATH` is set to `/usr/bin/chromium` in Dockerfile
- Check that Chromium dependencies are installed in Dockerfile
- This should be handled automatically by the Dockerfile

### Sync failures

- Check Railway logs for error details
- Verify Pacific Track credentials are correct
- Verify Supabase service account credentials
- Check VTX Uploads API URL is correct
- Look for error category in logs (login, navigation, export, upload, auth)

### Authentication failures (Invalid login credentials)

- If your password contains special characters (`&`, `#`, `!`, `@`, `*`, `$`, etc.):
  - **Local development**: Ensure password is wrapped in quotes in `.env` file: `SERVICE_ACCOUNT_PASSWORD="pass&word#123"`
  - **Railway production**: Do NOT use quotes - enter the raw password directly in Railway's environment variable UI
- Verify the password matches exactly what was set in Supabase
- Check for any whitespace or hidden characters in the password field
- Check logs for detailed error information

### Timezone issues

- Ensure `TZ=America/Los_Angeles` is set in Railway environment variables
- Verify cron schedule matches expected times in PST
- Check logs for timezone information

### Circuit breaker is open

- Check logs for circuit breaker status
- Circuit opens after 5 consecutive failures
- Auto-resets after 1 hour
- Successful sync will immediately close the circuit

### Email notifications not working

- Verify `RESEND_API_KEY` is set
- Verify `ENABLE_EMAIL_NOTIFICATIONS=true` is set
- Check `NOTIFICATION_EMAIL_TO` and `NOTIFICATION_EMAIL_FROM` are set
- Check logs for email sending errors
- Verify your Resend domain is verified

### How to check logs

- **Railway**: View logs in the Railway dashboard
- **Local**: Logs appear in console output
- **Production**: Logs are in JSON format for easy parsing
- **Development**: Logs are human-readable

### How to trigger manual run

- **Local**: Run `pnpm dev` or `pnpm test:run`
- **Production**: Use Railway's "Redeploy" or run `pnpm start:once` if you have shell access

### How to update credentials

- **Local**: Update `.env` file and restart
- **Railway**: Update environment variables in Railway dashboard and redeploy

## Project Structure

```
vtx-sync/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment configuration
│   ├── scheduler.ts           # Cron scheduler
│   ├── types.ts               # TypeScript interfaces
│   ├── services/
│   │   ├── api.ts             # VTX Uploads API client
│   │   ├── browser.ts         # Browser management
│   │   ├── emailService.ts    # Email notifications (Resend)
│   │   ├── exporter.ts        # Export orchestration
│   │   ├── notifier.ts        # Failure alerts (legacy)
│   │   ├── pacificTrack.ts    # Pacific Track automation
│   │   ├── retry.ts            # Retry logic
│   │   └── sync.ts             # Sync orchestration
│   ├── utils/
│   │   ├── circuitBreaker.ts  # Circuit breaker pattern
│   │   ├── download.ts        # Download utilities
│   │   ├── healthcheck.ts     # Healthcheck server
│   │   └── logger.ts           # Structured logging
│   └── scripts/
│       └── testRun.ts          # Test script
├── screenshots/               # Debug screenshots (gitignored)
├── Dockerfile                 # Docker configuration
├── railway.json              # Railway configuration
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## License

ISC
