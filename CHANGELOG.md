# Changelog

All notable changes to the VTX Sync Service project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-28

### Added

- **Automated Export from Pacific Track**
  - Puppeteer-based browser automation for logging into Pacific Track
  - Navigation to CTC OPS vehicles page
  - Automated XLSX export trigger and file capture
  - Screenshot capture for debugging failures

- **VTX Uploads API Integration**
  - Supabase authentication with service account
  - File upload to VTX Uploads API endpoint
  - Handling of duplicate filename responses (not treated as errors)
  - Upload statistics tracking (new records, duplicates, total rows)

- **Scheduled Execution**
  - Cron-based scheduler running every 30 minutes
  - Schedule: 5:00 AM to 10:00 PM Pacific Time, 7 days a week
  - Random delay (0-60 seconds) before each sync to avoid predictable patterns
  - Overlap prevention (skips new runs if previous is still in progress)

- **Retry Logic**
  - Automatic retry after 5 minutes on any failure
  - Single retry attempt per sync cycle
  - Retry status tracking in sync results

- **Error Handling & Categorization**
  - Error categories: login, navigation, export, upload, auth
  - Phase tracking (export, upload, complete)
  - Comprehensive error logging with context

- **Email Notifications**
  - Resend integration for email sending
  - Success emails with sync statistics
  - Failure emails sent only when retry is exhausted
  - Professional HTML email formatting
  - Configurable via environment variables

- **Circuit Breaker Pattern**
  - Tracks consecutive failures in memory
  - Opens circuit after 5 consecutive failures
  - Disables syncs for 1 hour when circuit is open
  - Auto-resets after timeout
  - Immediate reset on successful sync

- **Healthcheck Endpoint**
  - HTTP server on port 3000 (configurable)
  - `/health` endpoint returns service status
  - Tracks last run time, last run status, next scheduled run time
  - Useful for Railway health checks and monitoring

- **Structured Logging**
  - JSON-formatted logs in production
  - Human-readable logs in development
  - Run ID correlation for tracking sync cycles
  - Comprehensive context in log entries

- **Docker Support**
  - Custom Dockerfile optimized for Puppeteer
  - Uses system Chromium to reduce image size
  - Railway deployment ready

- **Configuration Management**
  - Environment variable-based configuration
  - Development mode with placeholder values
  - Production mode with strict validation
  - Support for special characters in passwords

- **Documentation**
  - Comprehensive README with setup instructions
  - Architecture diagrams
  - Troubleshooting guide
  - Environment variables documentation

### Technical Details

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript with strict mode
- **Browser Automation**: Puppeteer 24.x
- **HTTP Client**: Axios
- **Scheduling**: node-cron
- **Email**: Resend API
- **Hosting**: Railway

### Known Limitations

- Browser automation required (no Pacific Track API available)
- Single Pacific Track account support only
- Fixed schedule (not configurable via UI)
- Circuit breaker state is in-memory (resets on service restart)

### Future Enhancements (v1.1+)

- Daily summary email (successful runs, failures, records added)
- Web dashboard for monitoring
- Manual trigger endpoint
- Configurable schedule via environment variable
- Multiple Pacific Track account support
- Pacific Track API integration (when available)
- Sync history stored in database
- Circuit breaker state persistence
