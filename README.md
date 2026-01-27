# VTX Sync Service

Automated sync service that exports vehicle compliance data from Pacific Track and uploads it to VTX Uploads every 30 minutes during business hours.

## Overview

This service automates the manual process of:
1. Logging into Pacific Track (vtx.pacifictrack.com)
2. Navigating to the CTC OPS vehicles page
3. Exporting data as XLSX
4. Uploading the file to VTX Uploads (ctcops.smartctc.com)

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript
- **Browser Automation**: Puppeteer
- **HTTP Client**: Axios
- **Scheduling**: node-cron
- **Hosting**: Railway

## Prerequisites

- Node.js 20 or later
- pnpm package manager
- Pacific Track account credentials
- Supabase service account for VTX Uploads API

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

Edit `.env` with your credentials:

| Variable | Description |
|----------|-------------|
| `PACIFIC_TRACK_EMAIL` | Login email for Pacific Track |
| `PACIFIC_TRACK_PASSWORD` | Login password for Pacific Track |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase anon key |
| `SERVICE_ACCOUNT_EMAIL` | Sync service Supabase user email |
| `SERVICE_ACCOUNT_PASSWORD` | Sync service Supabase user password |
| `VTX_UPLOADS_API_URL` | Backend API base URL |
| `ALERT_EMAIL` | Email for failure notifications |
| `TZ` | Timezone for cron schedule (default: America/Los_Angeles) |
| `NODE_ENV` | Environment (development/production) |

## Running Locally

### Development mode (single run with watch)

```bash
pnpm dev
```

### Build for production

```bash
pnpm build
```

### Run production build

```bash
pnpm start
```

## Schedule

The service runs every 30 minutes from 5:00 AM to 10:00 PM Pacific Time, 7 days a week.

Cron expression: `0,30 5-22 * * *`

## Architecture

```
┌─────────────────────────────────────────────┐
│           VTX Sync Service                   │
│                                              │
│  ┌───────────┐  ┌────────────────────────┐  │
│  │ Scheduler │──│ Puppeteer Browser      │──┼──► Pacific Track
│  │ (cron)    │  │ (login, navigate,      │  │    (export XLSX)
│  └───────────┘  │  export)               │  │
│                 └────────────────────────┘  │
│                          │                   │
│                          ▼                   │
│                 ┌────────────────────────┐  │
│                 │ API Client (axios)     │──┼──► VTX Uploads API
│                 │ (authenticate, upload) │  │
│                 └────────────────────────┘  │
│                          │                   │
│                          ▼                   │
│                 ┌────────────────────────┐  │
│                 │ Email Alerts           │  │
│                 │ (on failure)           │  │
│                 └────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## Railway Deployment

### Prerequisites

1. Railway account (sign up at [railway.app](https://railway.app))
2. Git repository connected to Railway
3. All environment variables configured (see Configuration section below)

### Deployment Steps

1. **Create Railway Service**:
   - Go to Railway dashboard
   - Create new project or add to existing project
   - Connect your Git repository
   - Railway will automatically detect the Dockerfile

2. **Configure Environment Variables**:
   Add the following environment variables in Railway dashboard:
   
   ```
   PACIFIC_TRACK_EMAIL=<your-email>
   PACIFIC_TRACK_PASSWORD=<your-password>
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_KEY=<your-anon-key>
   SERVICE_ACCOUNT_EMAIL=vtx-sync@smartctc.com
   SERVICE_ACCOUNT_PASSWORD=<service-account-password>
   VTX_UPLOADS_API_URL=https://vtx-uploads-production.up.railway.app
   ALERT_EMAIL=team@smartctc.com
   TZ=America/Los_Angeles
   NODE_ENV=production
   ```
   
   Optional (for email notifications):
   ```
   RESEND_API_KEY=<resend-api-key>
   ```

3. **Deploy**:
   - Railway will automatically build and deploy on push to main branch
   - Or trigger manual deploy from Railway dashboard
   - Watch build logs for any errors

4. **Verify Deployment**:
   - Check logs show "Scheduler started" message
   - Verify timezone is set to America/Los_Angeles
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
  # ... other env vars
  vtx-sync
```

### Monitoring

- **Logs**: View real-time logs in Railway dashboard
- **Healthcheck**: Service exposes `/health` endpoint (port 3000)
- **Alerts**: Email notifications sent on sync failures (after retry exhausted)

### Troubleshooting

**Service won't start**:
- Check Railway logs for build errors
- Verify all required environment variables are set
- Ensure Dockerfile builds successfully

**Chromium not found**:
- Verify `PUPPETEER_EXECUTABLE_PATH` is set to `/usr/bin/chromium` in Dockerfile
- Check that Chromium dependencies are installed in Dockerfile

**Sync failures**:
- Check Railway logs for error details
- Verify Pacific Track credentials are correct
- Verify Supabase service account credentials
- Check VTX Uploads API URL is correct

**Timezone issues**:
- Ensure `TZ=America/Los_Angeles` is set in Railway environment variables
- Verify cron schedule matches expected times in PST

## License

ISC
