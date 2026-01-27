# VTX Sync Service - Build Plan

## Project Overview

This build plan creates an automated sync service that exports vehicle data from Pacific Track and uploads it to VTX Uploads every 30 minutes during business hours.

**Repository**: vtx-sync  
**Hosting**: Railway (same platform as vtx-uploads)  
**Runtime**: Node.js 20 + TypeScript + Puppeteer

---

## Pre-Build Setup (Human Steps)

### Step 0A: Create Supabase Service Account
**Status**: [x] Complete

**Instructions** (Human - do not use Cursor Agent):
1. Go to your Supabase dashboard
2. Navigate to Authentication → Users
3. Click "Add User" → "Create New User"
4. Email: `vtx-sync@smartctc.com`
5. Password: Generate a strong password and save it securely
6. This account will be used by the sync service to authenticate with VTX Uploads API

**Verification**:
- [x] User appears in Supabase Auth users list
- [x] You have saved the email and password securely
- [x] Test login at ctcops.smartctc.com with these credentials

---

### Step 0B: Gather Pacific Track Credentials
**Status**: [x] Complete

**Instructions** (Human):
1. Confirm you have the Pacific Track login credentials
2. Test manual login at vtx.pacifictrack.com/login
3. Verify you can navigate to CTC OPS → Vehicles and export

**Verification**:
- [x] Can log in manually
- [x] Can export XLSX file manually
- [x] Note the exact email used for login

---

## Project Setup

### Step 1: Initialize Project
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Create a new Node.js project for the VTX Sync Service:

1. Create project structure:
   /vtx-sync
   ├── src/
   │   ├── index.ts          # Entry point
   │   ├── config.ts         # Environment configuration
   │   └── types.ts          # TypeScript interfaces
   ├── package.json
   ├── tsconfig.json
   ├── .env.example
   ├── .gitignore
   └── README.md

2. Initialize with pnpm:
   - Name: vtx-sync
   - Version: 1.0.0
   - Main: dist/index.js

3. Install dependencies:
   Production: puppeteer, axios, node-cron, dotenv, @supabase/supabase-js
   Dev: typescript, @types/node, @types/node-cron, tsx, nodemon

4. Configure tsconfig.json:
   - Target: ES2022
   - Module: NodeNext
   - ModuleResolution: NodeNext
   - OutDir: ./dist
   - RootDir: ./src
   - Strict: true

5. Add scripts to package.json:
   - "dev": "tsx watch src/index.ts"
   - "build": "tsc"
   - "start": "node dist/index.js"

6. Create src/index.ts with a simple console.log("VTX Sync Service starting...")

7. Create src/config.ts that exports a config object reading from environment:
   - PACIFIC_TRACK_EMAIL
   - PACIFIC_TRACK_PASSWORD
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - SERVICE_ACCOUNT_EMAIL
   - SERVICE_ACCOUNT_PASSWORD
   - VTX_UPLOADS_API_URL
   - ALERT_EMAIL
   - NODE_ENV (default: development)
   - SYNC_DELAY_MAX_MS (default: 60000)
   - USER_AGENT (default: "CleanTruckCheckPro-Sync/1.0 (automated; contact: team@smartctc.com)")
   - Add validation that throws if required vars are missing (skip validation in dev if vars missing)

8. Create .env.example with all variables (no values)

9. Create .gitignore:
   - node_modules
   - dist
   - .env
   - *.log

10. Create README.md with:
    - Project description
    - Setup instructions
    - Environment variables list
    - How to run locally

Tests to complete before marking done:
1. Run `pnpm install` - should complete without errors
2. Run `pnpm dev` - should show "VTX Sync Service starting..."
3. Run `pnpm build` - should compile to /dist without errors
4. Run `pnpm start` - should run compiled code
5. Verify tsconfig paths are correct (no path errors)
6. Verify .gitignore excludes node_modules and .env

Mark this step complete only after all tests pass.
```

---

### Step 2: Create Logger Utility
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Create a structured JSON logger for the sync service:

1. Create src/utils/logger.ts:
   - Export a logger object with methods: info, warn, error, debug
   - Each log entry should be a JSON object with:
     - timestamp: ISO string
     - level: "info" | "warn" | "error" | "debug"
     - message: string
     - runId: optional string (for correlating logs within a sync run)
     - ...additionalData: any extra fields passed
   - In production, output JSON to console.log
   - In development, output formatted readable logs
   - Create a generateRunId() function that returns a short unique ID (e.g., 8 char random string)

2. Create src/types.ts:
   - Define LogEntry interface
   - Define SyncResult interface:
     - success: boolean
     - runId: string
     - startTime: Date
     - endTime?: Date
     - duration?: number (ms)
     - phase?: "login" | "export" | "upload" | "complete"
     - error?: string
     - errorCategory?: "login" | "navigation" | "export" | "upload" | "auth"
     - filename?: string
     - fileSize?: number
     - newRecords?: number
     - duplicates?: number
     - totalRows?: number

3. Update src/index.ts:
   - Import logger
   - Generate a runId on startup
   - Log "VTX Sync Service starting" with runId

Tests to complete before marking done:
1. Run `pnpm dev` - should show structured log output
2. Verify log includes timestamp and level
3. Set NODE_ENV=production and run - should output JSON
4. Verify generateRunId() produces unique IDs
5. Verify logger.error() includes error details properly
6. Build should complete without type errors

Mark this step complete only after all tests pass.
```

---

### Step 3: Pacific Track Export - Browser Setup
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Set up Puppeteer browser management:

1. Create src/services/browser.ts:
   - Function launchBrowser():
     - Launch Puppeteer with headless: true (or "new" for newer Puppeteer)
     - Set viewport: 1280x800
     - Set default timeout: 30000ms
     - Add args for Railway compatibility:
       - '--no-sandbox'
       - '--disable-setuid-sandbox'
       - '--disable-dev-shm-usage'
       - '--disable-gpu'
     - Return browser instance
   
   - Function closeBrowser(browser):
     - Safely close browser
     - Log closure
     - Handle errors gracefully (don't throw if already closed)

   - Function createPage(browser):
     - Create new page
     - Set user agent to: "CleanTruckCheckPro-Sync/1.0 (automated; contact: team@smartctc.com)"
     - This identifies your automation clearly and provides contact info if Pacific Track ever has questions
     - Return page instance

2. Create src/services/exporter.ts (skeleton):
   - Import browser utilities
   - Export async function exportFromPacificTrack(runId: string):
     - For now, just:
       - Log "Starting export"
       - Launch browser
       - Create page
       - Navigate to https://vtx.pacifictrack.com/login
       - Take a screenshot (for debugging)
       - Close browser
       - Log "Export complete (skeleton)"
       - Return null (will return file buffer later)

3. Update src/index.ts:
   - Import exportFromPacificTrack
   - Call it on startup (for testing)
   - Wrap in try/catch

4. Create /screenshots folder and add to .gitignore

Tests to complete before marking done:
1. Run `pnpm dev` - should launch browser (may see Chromium download first time)
2. Verify screenshot is saved to /screenshots folder
3. Verify screenshot shows Pacific Track login page
4. Verify browser closes properly (check task manager - no orphan Chrome processes)
5. Verify logs show browser launch and close
6. Run multiple times - should not accumulate browser processes
7. Build should complete without errors

Mark this step complete only after all tests pass.
```

---

### Step 4: Pacific Track Export - Login Flow
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Implement the Pacific Track login automation:

1. Create src/services/pacificTrack.ts:
   - Import config, logger, browser utilities
   
   - Function login(page: Page, runId: string):
     - Navigate to https://vtx.pacifictrack.com/login
     - Wait for page to load (wait for email input)
     - Find email input (try selectors: input[type="email"], input[name="email"], #email)
     - Find password input (try selectors: input[type="password"], input[name="password"], #password)
     - Type email from config (use page.type with delay: 50 for human-like typing)
     - Type password from config
     - Find and click login button (try: button[type="submit"], button:contains("Login"), #login-btn)
     - Wait for navigation to complete
     - Verify login success by checking URL changed from /login or checking for dashboard element
     - Log success or failure
     - Return boolean success
   
   - Add error handling:
     - If login fails, take screenshot named "login-failed-{timestamp}.png"
     - Throw descriptive error with category "login"

2. Update src/services/exporter.ts:
   - Import login from pacificTrack
   - After launching browser and creating page:
     - Call login(page, runId)
     - If login fails, close browser and throw
     - Take screenshot of dashboard (for debugging)
     - Log "Login successful"

3. Create .env file (copy from .env.example):
   - Add your Pacific Track test credentials (or placeholder values)
   - DO NOT commit .env file

Tests to complete before marking done:
1. Create .env with valid Pacific Track credentials
2. Run `pnpm dev` - should log in successfully
3. Verify screenshot shows dashboard (not login page)
4. Test with wrong password - should fail gracefully with "login" error category
5. Test with network disconnected - should timeout and report error
6. Verify no credentials appear in logs
7. Verify browser closes even on login failure
8. Check no orphan Chrome processes after failed login

Mark this step complete only after all tests pass.
```

---

### Step 5: Pacific Track Export - Navigate and Export
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Implement navigation to vehicles page and export trigger:

1. Update src/services/pacificTrack.ts:
   
   - Function navigateToVehicles(page: Page, runId: string):
     - Navigate directly to https://vtx.pacifictrack.com/carb/vehicles?page=1&limit=100
     - Wait for page to load (wait for table or Actions button)
     - Verify we're on the right page
     - Log navigation success
     - Return boolean success

   - Function triggerExport(page: Page, runId: string):
     - Find Actions button: #single-button
     - Click Actions button
     - Wait for dropdown to appear
     - Find Export option in dropdown (look for text "Export" or similar)
     - Click Export
     - Log "Export triggered"
     - Return boolean success

2. Update src/services/exporter.ts:
   - After successful login:
     - Call navigateToVehicles(page, runId)
     - If fails, screenshot and throw with "navigation" category
     - Take screenshot showing vehicles table
     - Call triggerExport(page, runId)
     - If fails, screenshot and throw with "export" category
     - Log "Export triggered, waiting for download..."

Tests to complete before marking done:
1. Run `pnpm dev` with valid credentials
2. Verify login succeeds
3. Verify navigation to vehicles page succeeds
4. Verify screenshot shows vehicles table
5. Verify Actions button click opens dropdown
6. Verify Export option is clicked
7. Should see export progress modal appear (may need to check screenshot)
8. Test with invalid URL - should fail with "navigation" category
9. Verify browser closes on any failure
10. Build completes without errors

Mark this step complete only after all tests pass.
```

---

### Step 6: Pacific Track Export - Download Capture
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Capture the exported XLSX file:

1. Update src/services/pacificTrack.ts:

   - Function waitForDownload(page: Page, runId: string): Promise<{buffer: Buffer, filename: string}>
     - Set up download behavior BEFORE triggering export:
       - Use CDP session to enable download interception
       - OR use page._client().send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: tempDir})
     - Alternative approach if CDP is complex:
       - Create a temp directory for downloads
       - Configure browser to download there
       - After export, wait for file to appear
       - Read file into buffer
       - Delete temp file
     - Wait for download to complete (poll for file or use CDP events)
     - Timeout after 60 seconds
     - Read file into Buffer
     - Extract filename
     - Log download complete with filename and size
     - Return { buffer, filename }

2. Create src/utils/download.ts:
   - Function setupDownloadDirectory(): string
     - Create temp directory if not exists
     - Return path
   - Function waitForFile(directory: string, timeout: number): Promise<string>
     - Poll directory for new .xlsx file
     - Return filename when found
     - Throw if timeout
   - Function cleanupDownload(filepath: string): void
     - Delete file after reading

3. Update src/services/exporter.ts:
   - Before triggering export, set up download directory
   - After triggerExport, call waitForDownload
   - Log file details: filename, size
   - Return the buffer and filename

4. Update src/types.ts:
   - Add ExportResult interface:
     - buffer: Buffer
     - filename: string
     - size: number

Tests to complete before marking done:
1. Run `pnpm dev` with valid credentials
2. Verify complete flow: login → navigate → export → download
3. Verify log shows filename (format: "Vehicles M-DD-YYYY H_MM_SS AM.xlsx")
4. Verify log shows file size (~79KB based on your screenshots)
5. Verify temp file is cleaned up after capture
6. Test export timeout - simulate by disconnecting network mid-export
7. Verify buffer contains valid XLSX data (first bytes should be PK for zip format)
8. Verify browser closes properly after download
9. Build completes without errors

Mark this step complete only after all tests pass.
```

**Implementation Notes** (added after completion):

This step was challenging due to Puppeteer download capture complexities. Key learnings:

1. **CDP Download Behavior Setup**:
   - `Page.setDownloadBehavior` is deprecated/unreliable in newer Puppeteer
   - Use `Browser.setDownloadBehavior` via CDP session instead:
     ```typescript
     const client = await page.createCDPSession();
     await client.send('Browser.setDownloadBehavior', {
       behavior: 'allow',
       downloadPath: downloadPath,
       eventsEnabled: true,  // Enable download progress events
     });
     ```
   - The `eventsEnabled: true` flag enables `Browser.downloadWillBegin` and `Browser.downloadProgress` events which are helpful for logging

2. **Export Button Click - Critical Issue**:
   - The dropdown contains multiple elements with "Export" text: `DIV`, `LI`, `BUTTON`, `SPAN`
   - Clicking the `LI` container does NOT trigger the export action
   - Must click the actual `BUTTON` element specifically
   - Solution: Prioritize clicking by element type: `BUTTON` > `A` > `LI`
   ```typescript
   // First, try to find a BUTTON with Export text
   const buttons = document.querySelectorAll('button');
   for (const btn of buttons) {
     if (btn.textContent?.trim().toLowerCase() === 'export') {
       btn.click();
       return { clicked: true };
     }
   }
   ```

3. **File System Polling Approach**:
   - CDP download events tell you when download starts/completes
   - But still need file system polling to read the actual file
   - Poll every 500ms, verify file size is stable before reading
   - Check first 2 bytes are `PK` (0x50, 0x4B) to verify valid XLSX/ZIP format

4. **Debugging Techniques**:
   - Add `HEADLESS=false` env var support to run in headed mode for visual debugging
   - Take screenshots at key moments: dropdown open, post-export click, on error
   - Log all elements found with "export" text to understand DOM structure
   - The dropdown screenshot was crucial for identifying the button click issue

5. **Common Pitfalls**:
   - `:has-text()` is Playwright syntax, NOT valid CSS - don't use with Puppeteer
   - Request interception (`page.setRequestInterception(true)`) can interfere with downloads
   - Windows paths work fine with CDP - no need to convert to forward slashes
   - Clean up temp directories in `finally` block to prevent accumulation

6. **Test Verification**:
   - Successful run shows: `Download starting` → `Download completed` → file captured
   - File size should be ~78-80KB for the vehicles export
   - Total export time is typically 15-25 seconds

---

### Step 7: VTX Uploads API Client
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Create the API client for VTX Uploads:

1. Create src/services/api.ts:
   - Import axios, config, logger
   
   - Function authenticateSupabase(runId: string): Promise<string>
     - Use Supabase client to sign in with email/password
     - Email: config.SERVICE_ACCOUNT_EMAIL
     - Password: config.SERVICE_ACCOUNT_PASSWORD
     - Return the access token (JWT)
     - Log success (but NOT the token)
     - On failure, throw with "auth" category

   - Function uploadToVtxUploads(buffer: Buffer, filename: string, token: string, runId: string): Promise<UploadResult>
     - Create FormData with file buffer
     - POST to ${config.VTX_UPLOADS_API_URL}/api/imports/upload
     - Headers: Authorization: Bearer ${token}, Content-Type: multipart/form-data
     - Parse response
     - Handle success response: return { success: true, importId, newRecords, duplicates, totalRows }
     - Handle duplicate filename (code: DUPLICATE_FILENAME): return { success: true, skipped: true, reason: "duplicate" }
     - Handle other errors: throw with "upload" category
     - Log result

2. Update src/types.ts:
   - Add UploadResult interface:
     - success: boolean
     - importId?: string
     - newRecords?: number
     - duplicates?: number
     - totalRows?: number
     - skipped?: boolean
     - reason?: string

3. Create a simple test in src/index.ts:
   - Call authenticateSupabase
   - Log the token length (not the token itself!)
   - This verifies Supabase connection works

Tests to complete before marking done:
1. Add service account credentials to .env
2. Run `pnpm dev` - should authenticate with Supabase
3. Verify log shows "Authentication successful" 
4. Verify token is NOT logged (only length or "token obtained")
5. Test with wrong password - should fail with "auth" category
6. Build completes without errors

Note: Full upload test will be done after integrating with export flow.

**Implementation Notes** (added after completion):

**Important: Special Characters in .env Values**
- Environment variable values containing special characters (such as `&`, `#`, `!`, `@`, `*`, `$`, etc.) must be wrapped in quotes in the `.env` file
- Example: `SERVICE_ACCOUNT_PASSWORD="J&2Kr#v!@@N3K*AR"` (with quotes)
- Without quotes, special characters may be interpreted by the shell or truncated, causing authentication failures
- If you see "Invalid login credentials" errors and the password contains special characters, check that it's properly quoted in `.env`

Mark this step complete only after all tests pass.
```

---

### Step 8: Complete Sync Flow
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Integrate export and upload into complete sync flow:

1. Create src/services/sync.ts:
   - Import exporter, api, logger, types
   
   - Function runSync(runId: string): Promise<SyncResult>
     - Log "Sync started" with runId
     - Record startTime
     - 
     - Phase 1: Export
       - Call exportFromPacificTrack(runId)
       - If fails, return error result with phase="export"
     - 
     - Phase 2: Authenticate
       - Call authenticateSupabase(runId)
       - If fails, return error result with phase="upload" (auth sub-error)
     - 
     - Phase 3: Upload
       - Call uploadToVtxUploads(buffer, filename, token, runId)
       - If fails, return error result with phase="upload"
     - 
     - Calculate duration
     - Log "Sync completed successfully" with stats
     - Return success result with all stats

2. Update src/services/exporter.ts:
   - Ensure it returns ExportResult { buffer, filename, size }
   - Ensure browser is ALWAYS closed (use try/finally)

3. Update src/index.ts:
   - Import runSync
   - Generate runId
   - Call runSync(runId)
   - Log final result
   - Exit with code 0 on success, 1 on failure

4. Update src/types.ts if needed:
   - Ensure SyncResult has all required fields

Tests to complete before marking done:
1. Run `pnpm dev` with all valid credentials
2. Verify complete flow executes: login → navigate → export → authenticate → upload
3. Verify logs show each phase
4. Verify final log shows: newRecords, duplicates, totalRows, duration
5. Run twice in a row - second run may show 0 newRecords (all duplicates) - this is expected
6. Verify process exits with code 0 on success
7. Test with invalid VTX Uploads URL - should fail with "upload" category
8. Verify browser always closes, even on upload failure
9. Build completes without errors

Mark this step complete only after all tests pass.
```

---

### Step 9: Retry Logic
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Implement retry logic for failed syncs:

1. Create src/services/retry.ts:
   - Import sync, logger, types
   
   - Constant RETRY_DELAY_MS = 5 * 60 * 1000 (5 minutes)
   
   - Function sleep(ms: number): Promise<void>
     - Simple promise-based delay
   
   - Function runSyncWithRetry(runId: string): Promise<SyncResult>
     - Call runSync(runId)
     - If success, return result
     - If failure:
       - Log "Sync failed, will retry in 5 minutes" with error details
       - Wait RETRY_DELAY_MS
       - Generate new runId for retry (e.g., originalRunId + "-retry")
       - Call runSync again
       - If retry succeeds, return result with note about retry
       - If retry fails, return failure result with isRetryExhausted: true

2. Update src/types.ts:
   - Add to SyncResult:
     - wasRetry?: boolean
     - isRetryExhausted?: boolean
     - originalError?: string

3. Update src/index.ts:
   - Use runSyncWithRetry instead of runSync
   - Log whether result was from retry

4. For development/testing, create environment variable:
   - RETRY_DELAY_MS (default: 300000, set to 5000 for testing)

Tests to complete before marking done:
1. Set RETRY_DELAY_MS=5000 (5 seconds) in .env for testing
2. Test with valid credentials - should succeed on first try
3. Temporarily break Pacific Track password - should fail, wait, retry, fail again
4. Verify logs show: initial failure, waiting message, retry attempt, final failure
5. Verify isRetryExhausted is true after retry fails
6. Fix password and run again - should succeed
7. Verify retry generates new runId with "-retry" suffix
8. Reset RETRY_DELAY_MS to 300000 or remove from .env
9. Build completes without errors

Mark this step complete only after all tests pass.
```

---

### Step 10: Email Notifications
**Status**: [x] Complete

**Implementation Notes** (added after completion):
- ✅ MVP implementation complete: Email notifications are implemented using Option C (logging)
- ✅ `src/services/notifier.ts` created with `sendFailureAlert()` function
- ✅ Alerts are logged with full email content when `isRetryExhausted` is true
- ✅ All required fields included: timestamp, runId, errorCategory, error message, phase
- ⚠️ **Actual email sending NOT implemented** - currently logs "ALERT: Would send email to team@smartctc.com"
- 📝 **Future enhancement**: Step 10B (optional) can implement actual email sending via Resend or Supabase Edge Function
- ✅ All tests passed: failure alerts trigger correctly, successful syncs do not trigger alerts

**Cursor Agent Prompt**:
```
Implement email notifications for failures:

1. Create src/services/notifier.ts:
   - Import Supabase client, config, logger
   
   - Function sendFailureAlert(result: SyncResult): Promise<void>
     - Only send if isRetryExhausted is true
     - Use Supabase's built-in email function or edge function
     - 
     - Email content:
       - To: config.ALERT_EMAIL (team@smartctc.com)
       - Subject: "VTX Sync Failed - {errorCategory}"
       - Body (plain text):
         ```
         VTX Sync Service - Failure Alert
         
         Time: {timestamp}
         Run ID: {runId}
         
         Error Category: {errorCategory}
         Error Message: {error}
         Phase: {phase}
         
         The sync will automatically retry at the next scheduled time.
         
         ---
         VTX Sync Service
         ```
     - Log email sent confirmation
     - Handle email send failures gracefully (log but don't throw)

2. Note on Supabase email:
   - Option A: Use Supabase Edge Function to send email
   - Option B: Use a simple SMTP service (like Resend) if Supabase email is complex
   - Option C: For MVP, just log "ALERT: Would send email to {address}" and implement actual email later
   
   - Start with Option C for faster development, can enhance later

3. Update src/index.ts:
   - After runSyncWithRetry completes:
     - If result.isRetryExhausted, call sendFailureAlert(result)
     - Log that alert was sent (or would be sent)

Tests to complete before marking done:
1. Run sync with broken credentials (force failure)
2. Wait for retry to also fail
3. Verify log shows "Would send email to team@smartctc.com" (or actual send)
4. Verify email content in log includes all required fields
5. Run successful sync - should NOT attempt to send email
6. Build completes without errors

Note: Actual email sending can be implemented in Step 10B if needed. For now, logging the alert is sufficient to verify the logic works.

Mark this step complete only after all tests pass.
```

---

### Step 10B: Email Notifications - Actual Sending (Optional)
**Status**: [ ] Complete

**Cursor Agent Prompt**:
```
Implement actual email sending via Supabase Edge Function or Resend:

Option A - Using Resend (simpler):

1. Install resend: pnpm add resend

2. Add to .env.example and .env:
   - RESEND_API_KEY=

3. Update src/services/notifier.ts:
   - Import Resend
   - Create Resend client with API key
   - In sendFailureAlert:
     - If RESEND_API_KEY is not set, fall back to logging
     - If set, send actual email via Resend
     - From: "VTX Sync <alerts@yourverifieddomain.com>" (or use Resend's default)
     - Handle errors gracefully

Option B - Using Supabase Edge Function:

1. Create Supabase Edge Function for sending email
2. Call it from notifier.ts

For this step, implement Option A (Resend) as it's simpler:

Tests to complete before marking done:
1. Sign up for Resend (free tier: 100 emails/day)
2. Get API key and add to .env
3. Verify your sending domain or use Resend's test domain
4. Force a sync failure
5. Verify actual email is received at team@smartctc.com
6. Verify email content matches expected format
7. Test with invalid API key - should log error but not crash
8. Test without API key - should fall back to logging

Mark this step complete only after all tests pass.
```

---

### Step 11: Cron Scheduler
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Implement the cron scheduler:

1. Create src/scheduler.ts:
   - Import node-cron, retry service, logger
   
   - Variable isRunning = false (to prevent overlapping runs)
   
   - Constant SYNC_DELAY_MAX_MS from config (default: 60000 = 60 seconds)
   
   - Function getRandomDelay(): number
     - Return random integer between 0 and SYNC_DELAY_MAX_MS
     - This spreads out requests to avoid predictable patterns
   
   - Function startScheduler():
     - Define cron expression: '0,30 5-22 * * *' (every 30 min, 5 AM - 10 PM)
     - Set timezone: 'America/Los_Angeles' (Pacific Time)
     - 
     - Create cron job that:
       - Checks if isRunning - if true, log "Skipping: previous run still in progress" and return
       - Sets isRunning = true
       - Generates runId
       - Calculate random delay and log "Waiting {X} seconds before sync"
       - Wait for random delay (0-60 seconds)
       - Calls runSyncWithRetry(runId)
       - Handles result (send alert if needed)
       - Sets isRunning = false (in finally block)
     - 
     - Log "Scheduler started" with cron expression and timezone
     - Log next scheduled run time
     - Return the cron job instance

   - Function getNextRunTime(): Date
     - Calculate and return the next scheduled run time
     - Useful for logging

2. Update src/index.ts:
   - Check if running in "scheduler" mode or "single" mode:
     - If command line arg "--once" or NODE_ENV=development: run single sync
     - Otherwise: start scheduler
   - 
   - In scheduler mode:
     - Call startScheduler()
     - Keep process alive
     - Handle SIGTERM/SIGINT for graceful shutdown

3. Update package.json scripts:
   - "dev": "tsx watch src/index.ts --once"  (single run for development)
   - "start": "node dist/index.js"  (scheduler mode for production)
   - "start:once": "node dist/index.js --once"  (single run in production)

Tests to complete before marking done:
1. Run `pnpm dev` - should run single sync and exit
2. Run `pnpm build && pnpm start` - should start scheduler
3. Verify log shows "Scheduler started" with cron expression
4. Verify log shows next scheduled run time
5. For testing: temporarily change cron to run every minute ('* * * * *')
6. Verify sync runs when cron triggers
7. Start a run, then trigger another (e.g., with test cron) - should skip second run
8. Test SIGTERM (Ctrl+C) - should log shutdown and exit cleanly
9. Reset cron to production schedule
10. Build completes without errors

Mark this step complete only after all tests pass.
```

---

### Step 12: Railway Deployment Configuration
**Status**: [x] Complete

**Cursor Agent Prompt**:
```
Prepare for Railway deployment:

1. Create railway.json (or railway.toml):
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "pnpm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 3
     }
   }
   ```

2. Create Dockerfile (alternative to Nixpacks, better for Puppeteer):
   ```dockerfile
   FROM node:20-slim
   
   # Install Chromium dependencies
   RUN apt-get update && apt-get install -y \
       chromium \
       fonts-liberation \
       libasound2 \
       libatk-bridge2.0-0 \
       libatk1.0-0 \
       libcups2 \
       libdbus-1-3 \
       libdrm2 \
       libgbm1 \
       libgtk-3-0 \
       libnspr4 \
       libnss3 \
       libxcomposite1 \
       libxdamage1 \
       libxrandr2 \
       xdg-utils \
       --no-install-recommends \
       && rm -rf /var/lib/apt/lists/*
   
   # Set Puppeteer to use installed Chromium
   ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
   
   WORKDIR /app
   
   # Install pnpm
   RUN npm install -g pnpm
   
   # Copy package files
   COPY package.json pnpm-lock.yaml ./
   
   # Install dependencies
   RUN pnpm install --frozen-lockfile
   
   # Copy source
   COPY . .
   
   # Build
   RUN pnpm build
   
   # Start
   CMD ["pnpm", "start"]
   ```

3. Update src/services/browser.ts:
   - Check for PUPPETEER_EXECUTABLE_PATH environment variable
   - Use it if set, otherwise let Puppeteer find Chromium

4. Create .dockerignore:
   - node_modules
   - dist
   - .env
   - screenshots
   - *.log
   - .git

5. Update README.md with Railway deployment instructions

Tests to complete before marking done:
1. Build Docker image locally: `docker build -t vtx-sync .`
2. Run Docker image: `docker run --env-file .env vtx-sync`
3. Verify sync runs successfully in Docker container
4. Verify Chromium is found and used
5. Verify logs appear in Docker output
6. Stop container with Ctrl+C - should exit gracefully

Mark this step complete only after all tests pass.
```

---

### Step 13: Deploy to Railway (Human Step)
**Status**: [ ] Complete

**Instructions** (Human - do not use Cursor Agent):

1. **Create Railway Service**:
   - Go to Railway dashboard
   - Create new project or add to existing
   - Connect your Git repository
   - Railway will detect Dockerfile

2. **Configure Environment Variables** in Railway:
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
   RESEND_API_KEY=<if-using-resend>
   ```

3. **Deploy**:
   - Trigger deploy from Railway dashboard
   - Watch build logs for errors
   - Watch runtime logs for "Scheduler started"

4. **Verify**:
   - Check logs show scheduler started with correct timezone
   - Wait for first scheduled run (or trigger manually)
   - Verify sync completes successfully
   - Check VTX Uploads for new import

**Verification Checklist**:
- [ ] Service deployed and running
- [ ] Logs show "Scheduler started"
- [ ] Timezone is America/Los_Angeles
- [ ] First sync runs at scheduled time
- [ ] Import appears in VTX Uploads
- [ ] No errors in logs

---

### Step 14: End-to-End Testing & Monitoring
**Status**: [ ] Complete

**Cursor Agent Prompt**:
```
Add final testing utilities and monitoring:

1. Create src/utils/healthcheck.ts:
   - Simple HTTP server on port from env (default 3000)
   - GET /health returns { status: "ok", lastRunTime, lastRunStatus, nextRunTime }
   - Track lastRunTime and lastRunStatus in memory
   - Update after each sync completes

2. Update src/index.ts:
   - Start healthcheck server in scheduler mode
   - Pass sync results to healthcheck tracker

3. Update src/scheduler.ts:
   - Export lastRunTime and lastRunStatus
   - Update after each run

4. Create src/scripts/testRun.ts:
   - Simple script to run a single sync
   - Useful for manual testing
   - Can be run with: pnpm tsx src/scripts/testRun.ts

5. Update package.json:
   - Add "test:run": "tsx src/scripts/testRun.ts"

6. Update Dockerfile to expose healthcheck port:
   - EXPOSE 3000

7. Update railway.json to include healthcheck:
   ```json
   {
     "deploy": {
       "healthcheckPath": "/health",
       "healthcheckTimeout": 30
     }
   }
   ```
   
   **Note**: The healthcheck configuration was temporarily removed from railway.json to prevent deployment failures before the endpoint was implemented. Restore these settings once the healthcheck endpoint is implemented in this step.

Tests to complete before marking done:
1. Run scheduler locally
2. Access http://localhost:3000/health - should return status
3. Run a sync, check health endpoint again - should show lastRunTime
4. Run `pnpm test:run` - should execute single sync
5. Deploy to Railway and verify healthcheck works
6. Railway should show service as healthy

Mark this step complete only after all tests pass.
```

---

### Step 15: Documentation & Cleanup
**Status**: [ ] Complete

**Cursor Agent Prompt**:
```
Final documentation and cleanup:

1. Update README.md with complete documentation:
   - Project overview
   - Architecture diagram (text-based)
   - Prerequisites
   - Local development setup
   - Environment variables (full list with descriptions)
   - How to run locally (dev mode, single run, scheduler mode)
   - Docker commands
   - Railway deployment guide
   - Monitoring (healthcheck, logs)
   - Troubleshooting guide:
     - Common errors and solutions
     - How to check logs
     - How to trigger manual run
     - How to update credentials

2. Create CHANGELOG.md:
   - v1.0.0 - Initial release
     - Automated export from Pacific Track
     - Upload to VTX Uploads API
     - 30-minute schedule (5 AM - 10 PM PST)
     - Retry on failure
     - Email alerts
     - Healthcheck endpoint

3. Code cleanup:
   - Remove any debug console.logs (use logger instead)
   - Remove commented-out code
   - Ensure all files have consistent formatting
   - Add JSDoc comments to exported functions

4. Create .env.example with ALL variables documented:
   ```
   # Pacific Track Credentials
   PACIFIC_TRACK_EMAIL=
   PACIFIC_TRACK_PASSWORD=
   
   # Supabase Configuration
   SUPABASE_URL=
   SUPABASE_SERVICE_KEY=
   
   # Service Account (for API authentication)
   SERVICE_ACCOUNT_EMAIL=
   SERVICE_ACCOUNT_PASSWORD=
   
   # VTX Uploads API
   VTX_UPLOADS_API_URL=https://vtx-uploads-production.up.railway.app
   
   # Notifications
   ALERT_EMAIL=team@smartctc.com
   RESEND_API_KEY=  # Optional, falls back to logging
   
   # Runtime Configuration
   TZ=America/Los_Angeles
   NODE_ENV=production
   PORT=3000  # Healthcheck port
   
   # Development only
   RETRY_DELAY_MS=300000  # 5 minutes, reduce for testing
   SYNC_DELAY_MAX_MS=60000  # Max random delay (0-60s), reduce for testing
   ```

5. Verify .gitignore is complete:
   - node_modules
   - dist
   - .env
   - screenshots/*.png
   - *.log
   - .DS_Store

Tests to complete before marking done:
1. Fresh clone of repo should work following README instructions
2. All environment variables documented in .env.example
3. No sensitive data in committed files
4. Code builds without warnings
5. Linting passes (if configured)
6. README troubleshooting section is helpful

Mark this step complete only after all tests pass.
```

---

## Completion Checklist

After all steps are complete, verify:

- [ ] All 15 steps marked complete
- [ ] Service runs locally in dev mode
- [ ] Service runs locally in scheduler mode  
- [ ] Docker build succeeds
- [ ] Docker container runs successfully
- [ ] Railway deployment successful
- [ ] Cron schedule triggers at correct times (PST)
- [ ] Export from Pacific Track works
- [ ] Upload to VTX Uploads API works
- [ ] Retry logic works on failure
- [ ] Email alerts sent on retry exhaustion (or logged)
- [ ] Healthcheck endpoint responds
- [ ] No credentials in code or logs
- [ ] Documentation is complete and accurate
- [ ] Service has been running successfully for 24 hours

---

## Post-Launch Monitoring (First Week)

1. **Day 1**: Monitor every sync run in Railway logs
2. **Day 2-3**: Check for any failures, verify retries work
3. **Day 4-7**: Spot check logs daily, verify data freshness in VTX Uploads
4. **After Week 1**: Set up Railway alerts for service crashes

---

## Future Enhancements (v1.1+)

- [ ] Daily summary email (successful runs, failures, records added)
- [ ] Web dashboard for monitoring
- [ ] Manual trigger endpoint
- [ ] Configurable schedule via environment variable
- [ ] Multiple Pacific Track account support
- [ ] Pacific Track API integration (if they fix their API)
- [ ] Sync history stored in database
