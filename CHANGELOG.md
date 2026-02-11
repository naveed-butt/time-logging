# Changelog

All notable changes to the "Time Tracker for Azure DevOps" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-11

### Added
- Initial release
- Timer functionality with start, pause, resume, and stop controls
- Status bar timer display showing current work item and elapsed time
- Azure DevOps integration with work item search by ID or title
- Support for multiple Azure DevOps organizations
- Manual time entry logging without running the timer
- Time entries view with sync status
- Sync time entries to Azure DevOps `CompletedWork` field
- Reports view with daily/weekly/monthly summaries
- Recent activity showing last 2 days' logged hours
- Secure PAT token storage using VS Code secrets API
- Compact UI optimized for VS Code sidebar

### Security
- PAT tokens stored securely using VS Code's secrets API
- No sensitive data stored in plain text
