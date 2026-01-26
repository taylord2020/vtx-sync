# VTX Sync Service - Product Requirements Document

## Overview

### Purpose
Automate the export of vehicle compliance data from Pacific Track (vtx.pacifictrack.com) and import it into the VTX Uploads system (ctcops.smartctc.com) on a scheduled basis.

### Problem Statement
Currently, syncing vehicle compliance data between Pacific Track and VTX Uploads requires manual steps:
1. Log into Pacific Track
2. Navigate to the CTC OPS vehicles page
3. Export data as XLSX
4. Log into VTX Uploads
5. Upload the XLSX file

This manual process needs to happen frequently throughout the day to keep data current. Automating this workflow will save time and ensure consistent, timely data synchronization.

### Solution
A Node.js service running on Railway that:
1. Uses Puppeteer to automate the Pacific Track export (browser automation required - no API available)
2. Calls the VTX Uploads API directly to upload the exported file (no browser automation needed)
3. Runs on a cron schedule every 30 minutes during business hours
4. Sends email alerts on failure
5. Implements retry logic for resilience

---

## Technical Architecture

### System Diagram

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
│  │                   │ (Supabase)   │  │  │   │                    │
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

### Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js 20 LTS | Matches existing vtx-uploads stack |
| Language | TypeScript | Type safety, matches existing codebase |
| Browser Automation | Puppeteer | Industry standard, good Railway support |
| HTTP Client | Axios | Simple, reliable for API calls |
| Scheduling | node-cron | Lightweight, proven reliability |
| Email | Supabase Auth emails | Already configured, no additional setup |
| Hosting | Railway | Same platform as existing services |

### Data Flow

1. **Cron Trigger**: node-cron fires at scheduled intervals
2. **Export Phase**:
   - Launch headless Chromium browser
   - Navigate to Pacific Track login
   - Enter credentials and submit
   - Navigate to vehicles page
   - Click Actions → Export
   - Wait for download to complete
   - Capture file buffer in memory
3. **Upload Phase**:
   - Authenticate with Supabase (service account)
   - POST file to VTX Uploads API
   - Parse response for success/failure
4. **Notification Phase**:
   - On success: Log result (optional success email)
   - On failure: Send alert email, schedule retry
5. **Cleanup**: Close browser, clear memory

---

## Functional Requirements

### FR-1: Scheduled Execution
- **FR-1.1**: Service runs every 30 minutes
- **FR-1.2**: Schedule: 5:00 AM to 10:00 PM PST (Pacific Time)
- **FR-1.3**: Runs 7 days per week with no exceptions
- **FR-1.4**: Total of 36 runs per day (5:00, 5:30, 6:00... 21:30, 22:00)
- **FR-1.5**: If a run is still in progress when the next scheduled time arrives, skip the new run and log a warning

### FR-2: Pacific Track Export
- **FR-2.1**: Automate login to vtx.pacifictrack.com/login
- **FR-2.2**: Handle standard email/password authentication
- **FR-2.3**: Navigate to https://vtx.pacifictrack.com/carb/vehicles
- **FR-2.4**: Click the Actions button (#single-button)
- **FR-2.5**: Click Export option in dropdown
- **FR-2.6**: Wait for export progress modal to complete
- **FR-2.7**: Capture downloaded XLSX file (filename format: `Vehicles M-DD-YYYY H_MM_SS AM/PM.xlsx`)
- **FR-2.8**: Expected export duration: <10 seconds typical, timeout after 60 seconds

### FR-3: VTX Uploads Integration
- **FR-3.1**: Authenticate with Supabase using service account credentials
- **FR-3.2**: Upload XLSX file to POST /api/imports/upload
- **FR-3.3**: Handle successful upload response (new records added, duplicates skipped)
- **FR-3.4**: Handle duplicate filename rejection gracefully (not an error condition)
- **FR-3.5**: Log upload statistics (rows processed, new records, duplicates)

### FR-4: Error Handling & Retry
- **FR-4.1**: On any failure, wait 5 minutes and retry once
- **FR-4.2**: If retry also fails, send alert email and skip until next scheduled run
- **FR-4.3**: Categorize errors:
  - Login failure (invalid credentials, page not loading)
  - Navigation failure (page structure changed)
  - Export failure (timeout, download failed)
  - Upload failure (API error, network issue)
  - Authentication failure (Supabase token issues)

### FR-5: Email Notifications
- **FR-5.1**: Send email alert on sync failure (after retry exhausted)
- **FR-5.2**: Email recipient: team@smartctc.com
- **FR-5.3**: Email includes: timestamp, error type, error message, which phase failed
- **FR-5.4**: Use Supabase's built-in email functionality
- **FR-5.5**: Optional: Daily summary email (defer to v1.1)

### FR-6: Logging & Monitoring
- **FR-6.1**: Log all sync attempts with timestamps
- **FR-6.2**: Log success with statistics (records added, duplicates, duration)
- **FR-6.3**: Log failures with error details
- **FR-6.4**: Logs viewable in Railway dashboard
- **FR-6.5**: Log format: JSON for easy parsing

---

## Non-Functional Requirements

### NFR-1: Performance
- Single sync cycle should complete in under 2 minutes
- Memory usage should stay under 512MB
- Browser instance should be properly closed after each run

### NFR-2: Reliability
- Service should auto-restart on crash (Railway handles this)
- Should handle Pacific Track being temporarily unavailable
- Should handle VTX Uploads API being temporarily unavailable

### NFR-3: Security
- Credentials stored in Railway environment variables (encrypted at rest)
- No credentials in code or logs
- Service account has minimal required permissions
- HTTPS for all external communications

### NFR-5: Responsible Automation
- Random delay (0-60 seconds) before each sync to avoid predictable load patterns
- Custom user-agent identifying the automation: "CleanTruckCheckPro-Sync/1.0"
- Graceful, human-like interaction patterns (typing delays, reasonable timeouts)

### NFR-4: Maintainability
- Clear separation of concerns (export, upload, notify modules)
- Comprehensive error messages for debugging
- Configuration via environment variables (no code changes for config)

---

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PACIFIC_TRACK_EMAIL` | Login email for Pacific Track | user@company.com |
| `PACIFIC_TRACK_PASSWORD` | Login password for Pacific Track | ••••••••• |
| `SUPABASE_URL` | Supabase project URL | https://xxx.supabase.co |
| `SUPABASE_SERVICE_KEY` | Service account credentials (anon key) | eyJhbG... |
| `SERVICE_ACCOUNT_EMAIL` | Sync service Supabase user email | sync-service@smartctc.com |
| `SERVICE_ACCOUNT_PASSWORD` | Sync service Supabase user password | ••••••••• |
| `VTX_UPLOADS_API_URL` | Backend API base URL | https://vtx-uploads-production.up.railway.app |
| `ALERT_EMAIL` | Email for failure notifications | team@smartctc.com |
| `TZ` | Timezone for cron schedule | America/Los_Angeles |
| `NODE_ENV` | Environment | production |
| `SYNC_DELAY_MAX_MS` | Max random delay before sync (ms) | 60000 |
| `USER_AGENT` | Browser user agent for identification | CleanTruckCheckPro-Sync/1.0 |

### Cron Schedule
```
# Every 30 minutes from 5:00 AM to 10:00 PM PST
# Minutes: 0,30
# Hours: 5-22
# Cron expression: 0,30 5-22 * * *
```

---

## User Stories

### US-1: Automated Data Sync
**As a** fleet compliance manager  
**I want** vehicle data to automatically sync from Pacific Track to VTX Uploads  
**So that** I always have current compliance data without manual intervention

**Acceptance Criteria:**
- Data syncs every 30 minutes during business hours
- New records appear in VTX Uploads device search
- Duplicate records are handled gracefully (skipped, not errors)

### US-2: Failure Notification
**As a** system administrator  
**I want** to receive email alerts when sync fails  
**So that** I can investigate and resolve issues promptly

**Acceptance Criteria:**
- Email sent within 10 minutes of failure (after retry)
- Email contains enough detail to diagnose the issue
- Email includes timestamp and error category

### US-3: Resilient Operation
**As a** system administrator  
**I want** the sync service to handle temporary failures gracefully  
**So that** occasional network issues don't require manual intervention

**Acceptance Criteria:**
- Single failure triggers automatic retry after 5 minutes
- Successful retry does not send alert email
- Service continues normal schedule after retry (success or failure)

---

## Out of Scope (v1.0)

The following features are explicitly deferred:

1. **Pacific Track API Integration** - Would require debugging their API; browser automation is more reliable for now
2. **Web Dashboard** - Monitoring via Railway logs is sufficient
3. **Manual Trigger** - Can be added later if needed
4. **Success Notifications** - Only failures trigger emails
5. **Historical Sync Logs in Database** - Logs in Railway are sufficient
6. **Multiple Pacific Track Accounts** - Single account only
7. **Configurable Schedule via UI** - Schedule is fixed in code

---

## Future Migration: Pacific Track API Integration

This sync service is designed as a **bridge solution**. When Pacific Track's API becomes viable, the sync functionality should migrate into the vtx-uploads application directly.

### Current Architecture (v1.0 - Sync Service)

```
┌─────────────────┐                      ┌─────────────────┐
│   vtx-sync      │─────HTTP POST───────▶│   vtx-uploads   │
│                 │                      │                 │
│ - Puppeteer     │                      │ - Express API   │
│ - Browser login │                      │ - Supabase DB   │
│ - XLSX export   │                      │                 │
└────────┬────────┘                      └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Pacific Track   │
│ (browser UI)    │
└─────────────────┘
```

### Future Architecture (v2.0 - API Integration)

```
┌───────────────────────────────────────────────────────┐
│                     vtx-uploads                        │
│                                                        │
│  ┌─────────────┐    ┌────────────────────────────┐   │
│  │ Express API │    │ Background Sync Worker     │   │
│  │             │    │                            │   │
│  │ /api/...    │    │ - Cron schedule            │   │
│  │             │    │ - Pacific Track API client │   │
│  │             │    │ - Direct database writes   │   │
│  └─────────────┘    └─────────────┬──────────────┘   │
│                                   │                   │
│                                   ▼                   │
│                          ┌──────────────┐            │
│                          │   Supabase   │            │
│                          └──────────────┘            │
└───────────────────────────────────────────────────────┘
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │   Pacific Track API     │
                      │   (JSON responses)      │
                      └─────────────────────────┘
```

### Migration Benefits

| Aspect | Current (Sync Service) | Future (API Integration) |
|--------|------------------------|--------------------------|
| Infrastructure | Separate Railway service (~$5/mo) | Single service |
| Dependencies | Puppeteer (~400MB) | Axios only (tiny) |
| Reliability | Medium (UI can change) | High (APIs are stable) |
| Speed | 10-30 seconds per sync | Milliseconds |
| Complexity | High (browser automation) | Low (HTTP requests) |
| Sync frequency | Every 30 min practical limit | Could sync every minute |

### Migration Steps (When Ready)

1. **Keep sync service running** - Don't disrupt working system
2. **Obtain Pacific Track API credentials** - API key, OAuth token, or similar
3. **Build API client in vtx-uploads** - New service file: `pacificTrackSync.ts`
4. **Add background worker** - Cron job within the vtx-uploads server
5. **Test in parallel** - Run both methods, compare results
6. **Validate data parity** - Ensure API returns same data as XLSX export
7. **Switch over** - Disable sync service, enable API integration
8. **Decommission sync service** - Delete Railway service, archive repo

### Requirements From Pacific Track

To migrate, you'll need:
- API documentation (endpoints, authentication, response format)
- API credentials (key or OAuth setup)
- Rate limit information
- Confirmation that API returns equivalent data to XLSX export

### Code Location (Future)

```
/vtx-uploads/server/src/
├── services/
│   └── pacificTrackSync.ts    # API client for Pacific Track
├── workers/
│   └── syncWorker.ts          # Cron-based background job
└── index.ts                   # Worker startup logic
```

This migration path is documented here for future reference. The sync service should be treated as temporary infrastructure until API integration is feasible.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sync Success Rate | >95% | (Successful syncs / Attempted syncs) per week |
| Average Sync Duration | <60 seconds | Time from cron trigger to upload complete |
| Alert Response Time | <10 minutes | Time from failure to email received |
| Data Freshness | <35 minutes | Max age of data in VTX Uploads |

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Pacific Track changes UI | High | Medium | Use stable selectors, add screenshot on failure for debugging |
| Pacific Track adds 2FA | High | Low | Would require manual intervention; monitor for changes |
| Railway Puppeteer issues | Medium | Low | Use official Puppeteer Docker image, test thoroughly |
| Supabase email rate limits | Low | Low | Only send on failure, ~1-2 emails max per day expected |
| Memory leaks in Puppeteer | Medium | Medium | Ensure browser closes properly, Railway auto-restarts |

---

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| Setup & Infrastructure | 1-2 hours | Project init, Railway service, env vars |
| Export Automation | 2-3 hours | Puppeteer login, navigation, download |
| Upload Integration | 1 hour | API client, Supabase auth |
| Error Handling & Retry | 1-2 hours | Retry logic, error categorization |
| Email Notifications | 1 hour | Supabase email integration |
| Testing & Polish | 2-3 hours | End-to-end testing, edge cases |
| **Total** | **8-12 hours** | |

---

## Appendix

### A. Pacific Track Page Selectors

| Element | Selector | Notes |
|---------|----------|-------|
| Email input | `input[type="email"]` or by placeholder | Login page |
| Password input | `input[type="password"]` | Login page |
| Login button | `button[type="submit"]` or text "Login" | Login page |
| Actions button | `#single-button` | Vehicles page |
| Export option | Text "Export" in dropdown | Vehicles page |
| Progress modal | `.export-progress` or similar | During export |

*Note: Exact selectors to be confirmed during implementation*

### B. VTX Uploads API Reference

**POST /api/imports/upload**

Request:
```
Content-Type: multipart/form-data
Authorization: Bearer <supabase_jwt>

file: <xlsx_binary>
```

Response (success):
```json
{
  "success": true,
  "message": "Import completed successfully",
  "data": {
    "import_id": "uuid",
    "filename": "Vehicles 1-26-2026 6_02_27 AM.xlsx",
    "total_rows": 688,
    "inserted_rows": 15,
    "skipped_rows": 673
  }
}
```

Response (duplicate filename):
```json
{
  "success": false,
  "error": "duplicate_filename",
  "code": "DUPLICATE_FILENAME"
}
```

### C. Sample Log Output

```json
{"timestamp":"2026-01-26T13:00:00.000Z","level":"info","message":"Sync started","runId":"abc123"}
{"timestamp":"2026-01-26T13:00:05.000Z","level":"info","message":"Login successful","runId":"abc123"}
{"timestamp":"2026-01-26T13:00:08.000Z","level":"info","message":"Export started","runId":"abc123"}
{"timestamp":"2026-01-26T13:00:15.000Z","level":"info","message":"Export complete","runId":"abc123","filename":"Vehicles 1-26-2026 1_00_08 PM.xlsx","size":81920}
{"timestamp":"2026-01-26T13:00:18.000Z","level":"info","message":"Upload complete","runId":"abc123","newRecords":12,"duplicates":676,"duration":"18s"}
{"timestamp":"2026-01-26T13:00:18.000Z","level":"info","message":"Sync completed successfully","runId":"abc123"}
```
