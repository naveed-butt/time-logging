# Time Tracker for Azure DevOps

A lightweight Windows desktop application to track time on Azure DevOps work items and sync completed hours directly to ADO.

## Features

- **Timer**: Start/pause/stop timer on any work item assigned to you
- **Multiple ADO Organizations**: Connect to multiple Azure DevOps orgs and projects
- **Manual Sync**: Push logged time to ADO's `CompletedWork` field when ready
- **System Tray**: Runs in background, minimize to tray on close
- **Reports**: View daily/weekly summaries with charts
- **Windows Startup**: Optional launch on Windows login

## Tech Stack

- **Tauri 2.x** - Lightweight desktop app framework (~10MB, ~30MB RAM)
- **React 19** - Frontend UI
- **TypeScript** - Type safety
- **Vite** - Fast build tooling

## Prerequisites

1. **Node.js 18+**: https://nodejs.org/
2. **Rust**: https://rustup.rs/
   - Run: `winget install Rustlang.Rustup` or download from rustup.rs
   - After install, restart terminal and verify: `rustc --version`
3. **Visual Studio Build Tools**:
   - Required for Windows Tauri builds
   - Install via VS Installer with "Desktop development with C++" workload

## Development Setup

```bash
# Install dependencies
npm install

# Start development (frontend only)
npm run dev

# Start Tauri development (full app with Rust backend)
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
Time Tracker/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── Timer.tsx       # Main timer interface
│   │   ├── TimeEntries.tsx # Time entry list & sync
│   │   ├── Settings.tsx    # ADO org management
│   │   ├── Reports.tsx     # Analytics & charts
│   │   └── Sidebar.tsx     # Navigation
│   ├── context/            # React context (state management)
│   ├── services/           # API & database services
│   │   ├── azureDevOps.ts  # ADO REST API client
│   │   └── database.ts     # Local storage service
│   ├── types/              # TypeScript interfaces
│   └── styles/             # CSS styles
├── src-tauri/              # Rust backend
│   ├── src/lib.rs          # Tauri app with tray support
│   ├── tauri.conf.json     # App configuration
│   └── Cargo.toml          # Rust dependencies
└── public/                 # Static assets
```

## Azure DevOps Setup

1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create a new token with these scopes:
   - **Work Items**: Read & Write
3. Copy the token (you won't see it again)
4. In Time Tracker Settings, add your organization:
   - Organization URL: `https://dev.azure.com/yourorg`
   - Project: Your project name
   - PAT Token: Paste your token

## How It Works

1. **Select Work Item**: Search or pick from your assigned items
2. **Start Timer**: Click start to begin tracking
3. **Stop Timer**: Saves entry locally with duration
4. **Sync to ADO**: Select entries and sync to update `CompletedWork` field in ADO

## Configuration

Settings are stored locally in browser storage (will be SQLite in production).

- **Minimize to Tray**: Keep running when window is closed
- **Start with Windows**: Launch on login (uses Tauri autostart plugin)
- **Time Rounding**: Round to 1/5/15/30 minute intervals

## Building for Distribution

```bash
# Build Windows installer (NSIS or MSI)
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`.

## License

MIT
