# Time Tracker for Azure DevOps

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visualstudiocode)](https://github.com/naveed-butt/time-logging)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A VS Code extension to track time on Azure DevOps work items and sync completed hours directly to ADO.

## Features

- **Timer**: Start/pause/stop timer on any work item assigned to you
- **Status Bar Display**: Current timer shown in VS Code status bar
- **Manual Time Logging**: Add time entries without running the timer
- **Multiple ADO Organizations**: Connect to multiple Azure DevOps orgs and projects
- **Manual Sync**: Push logged time to ADO's `CompletedWork` field when ready
- **Reports**: View daily/weekly summaries with charts
- **Recent Activity**: See last 2 days' logged hours at a glance

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Press F5 to launch the extension in VS Code

## Tech Stack

- **VS Code Extension API** - Integration with VS Code
- **React 19** - Webview UI
- **TypeScript** - Type safety
- **Vite** - Fast webview build

## Prerequisites

- **Node.js 18+**: https://nodejs.org/
- **VS Code 1.85+**: https://code.visualstudio.com/

## Development Setup

```bash
# Install dependencies
npm install

# Build extension and webview
npm run build

# Watch for changes during development
npm run dev
```

Press **F5** in VS Code to launch the Extension Development Host.

## Project Structure

```
Time Tracker/
├── src/
│   ├── extension.ts         # Extension entry point
│   ├── providers/           # VS Code providers
│   │   ├── WebviewProvider.ts   # Sidebar webview
│   │   └── TimerStatusBar.ts    # Status bar item
│   ├── services/            # Extension host services
│   │   ├── timerService.ts      # Timer state machine
│   │   ├── stateService.ts      # Persistence wrapper
│   │   ├── azureDevOps.ts       # ADO REST API client
│   │   └── types.ts             # Shared types
│   └── webview/             # React frontend
│       ├── components/      # UI components
│       ├── context/         # React context
│       ├── types/           # TypeScript interfaces
│       └── styles/          # CSS styles
├── out/                     # Compiled output
│   ├── extension.js         # Extension host code
│   └── webview/             # Built webview assets
├── media/                   # Extension icons
└── .vscode/                 # VS Code configuration
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

1. **Open Time Tracker**: Click the clock icon in the Activity Bar
2. **Add Organization**: Configure your ADO connection in Settings
3. **Select Work Item**: Search by ID (e.g., #12345) or title
4. **Start Timer**: Click start to begin tracking
5. **Stop Timer**: Saves entry locally with duration
6. **Sync to ADO**: Select entries and sync to update `CompletedWork` field

## Commands

- `Time Tracker: Start Timer` - Start the timer on current work item
- `Time Tracker: Stop Timer` - Stop timer and save entry
- `Time Tracker: Pause Timer` - Pause the running timer
- `Time Tracker: Resume Timer` - Resume a paused timer
- `Time Tracker: Sync Time Entries to Azure DevOps` - Sync pending entries

## Building for Distribution

```bash
# Install vsce if not already installed
npm install -g @vscode/vsce

# Package the extension
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.

## License

MIT
