# Tamandua EDR Desktop GUI

Modern desktop application for managing and monitoring the Tamandua EDR agent.

## Architecture

Built with [Tauri](https://tauri.app/) - a lightweight, secure framework for building desktop applications with web technologies.

```
tamandua_gui/
├── src-tauri/          # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs     # Application entry point
│   │   ├── commands.rs # Tauri commands (backend API)
│   │   ├── ipc.rs      # IPC client for agent communication
│   │   ├── state.rs    # Application state management
│   │   └── tray.rs     # System tray integration
│   └── Cargo.toml
│
├── src/                # React frontend
│   ├── pages/          # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Alerts.tsx
│   │   ├── Scan.tsx
│   │   └── Settings.tsx
│   ├── components/     # Reusable components
│   │   └── Layout.tsx
│   ├── hooks/          # Custom React hooks
│   │   └── useTauri.ts # Tauri integration hooks
│   ├── lib/            # Utilities
│   └── App.tsx
│
└── package.json
```

## Features

### Dashboard
- Real-time agent status monitoring
- System resource metrics (CPU, memory, disk)
- Recent alerts overview
- Agent information display

### Alerts
- Alert management with filtering
- Severity-based categorization
- Response actions (dismiss, quarantine, kill process)
- Export alerts to JSON/CSV
- Real-time alert notifications

### Scan
- On-demand malware scanning
- Quick, full, and custom scan modes
- Real-time progress tracking
- Threat findings display
- Scan history

### Settings
- Agent configuration management
- Collector enable/disable
- Detection settings (YARA, Sigma, ML)
- Network isolation controls
- Connection testing

### System Tray
- Background operation
- Quick actions menu
- Status indicator
- Minimize to tray

## Technology Stack

### Backend (Rust/Tauri)
- **Tauri 1.5**: Desktop framework
- **tokio**: Async runtime
- **tokio-tungstenite**: WebSocket client
- **serde**: Serialization

### Frontend (React)
- **React 18**: UI library
- **TypeScript**: Type safety
- **TanStack Query**: Data fetching and caching
- **React Router**: Navigation
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **date-fns**: Date formatting

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- npm or yarn

### Install Dependencies

```bash
cd apps/tamandua_gui
npm install
```

### Run in Development Mode

```bash
npm run tauri:dev
```

This will:
1. Start the Vite dev server (React frontend)
2. Build and run the Tauri app
3. Hot-reload on file changes

### Build for Production

```bash
npm run tauri:build
```

This project is pinned to **Tauri v1**. Use the repo-local CLI through npm and avoid running
`cargo tauri build` directly if the machine has a global Tauri v2 installation.

For environment checks:

```bash
npm run tauri:check
```

For Windows packaging:

```bash
npm run bundle:portable
npm run bundle:windows
```

`bundle:portable` builds a zipped `.exe`.
`bundle:windows` attempts a full MSI build and requires WiX in `PATH`.

## IPC Communication

The GUI communicates with the Tamandua agent over local IPC:

```
[GUI] <- Named Pipe / Unix Socket -> [Agent]
```

On Windows the GUI uses a named pipe. On Linux/macOS it uses a Unix domain socket.

### Request/Response Protocol

```typescript
// Request
{
  "type": "GetStatus",
  "payload": null
}

// Response
{
  "type": "Status",
  "payload": {
    "agent_id": "...",
    "status": "running",
    ...
  }
}
```

### Real-time Events

The agent pushes events to the GUI:

```typescript
{
  "type": "NewAlert",
  "payload": { ... }
}
```

Events are broadcast to all subscribers via the `AppState` event channel.

## Configuration

### Environment Variables

```bash
# Agent IPC URL (default: ws://127.0.0.1:9876)
TAMANDUA_AGENT_IPC_URL=ws://127.0.0.1:9876

# Enable debug logging
RUST_LOG=debug
```

### Tauri Configuration

See `src-tauri/tauri.conf.json` for app metadata, window settings, and permissions.

## Security

### Sandboxing

Tauri uses OS-level sandboxing:
- Windows: AppContainer
- macOS: App Sandbox
- Linux: seccomp

### Permissions

The GUI requests minimal permissions:
- File system (for scan paths and exports)
- Notifications
- System tray

### IPC Security

- Agent IPC is localhost-only (`127.0.0.1`)
- Future: Add authentication token for IPC
- Future: Add TLS for IPC WebSocket

## Building

### Windows

```bash
npm run tauri:build
```

Creates:
- `tamandua-gui_0.1.0_x64_en-US.msi` when WiX is installed
- `tamandua-gui.exe` in the release target

For a reproducible portable artifact without WiX:

```bash
npm run bundle:portable
```

### Linux

```bash
npm run tauri:build
```

Creates:
- `tamandua-gui_0.1.0_amd64.deb` (Debian/Ubuntu)
- `tamandua-gui_0.1.0_amd64.AppImage` (universal)

### macOS

```bash
npm run tauri:build
```

Creates:
- `Tamandua EDR.app` (application bundle)
- `Tamandua-vX.Y.Z-{x86_64,arm64}.dmg` (signed/notarized installer)

## Troubleshooting

### `cargo tauri build` fails with schema errors

This usually means the machine has a global **Tauri v2** CLI while this repo still uses
**Tauri v1** config and dependencies.

Use:

```bash
npm install
npm run tauri:build
```

or:

```bash
npx @tauri-apps/cli@1.5 build
```

Do not use the global `cargo tauri build` path unless the CLI major version is aligned.

### MSI bundling is unavailable

Install WiX Toolset and ensure `candle.exe` or `wix.exe` is available in `PATH`.

Without WiX, fall back to:

```bash
npm run bundle:portable
```

### GUI can't connect to agent

1. Ensure agent is running
2. Check agent IPC listener is enabled
3. Verify port 9876 is not blocked
4. Check logs: `RUST_LOG=debug npm run tauri:dev`

### Build failures

```bash
# Clear caches
rm -rf src-tauri/target
rm -rf node_modules
npm install
npm run tauri:build
```

### Updater expectations

There are two distinct update paths:

1. The **Settings > Agent Updates** panel talks to the local agent over IPC.
2. The **Tauri updater** in `src-tauri/tauri.conf.json` is for updating the GUI executable itself.

The GUI self-update feed still depends on:

- a real signed release feed
- a non-placeholder Minisign public key
- published artifacts at `updates.treantlab.org`

## Performance

### Memory Usage

- Idle: ~50-80 MB
- Active: ~100-150 MB

### CPU Usage

- Idle: <1%
- Active: 2-5%

### Bundle Size

- Windows: ~8-12 MB
- Linux: ~10-15 MB
- macOS: ~8-12 MB

## Comparison: Tauri vs Electron

| Feature | Tauri | Electron |
|---------|-------|----------|
| Bundle Size | 8-15 MB | 80-150 MB |
| Memory Usage | 50-150 MB | 150-400 MB |
| Startup Time | <1s | 2-5s |
| Security | Native sandbox | Chromium sandbox |
| Backend | Rust | Node.js |

## License

MIT

## References

- [Tauri Documentation](https://tauri.app/)
- [Firezone Tauri Implementation](https://github.com/firezone/firezone)
- [Tamandua EDR Documentation](../../ROADMAP.md)
