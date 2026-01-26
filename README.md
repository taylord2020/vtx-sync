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

## License

ISC
