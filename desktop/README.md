# Aiyedun Desktop Agent

Lightweight desktop app (~10 MB) that gives users access to Aiyedun AI without opening a browser. Built with Tauri v2 + React 18 + TypeScript.

## Installation

Download the installer for your platform from the GitLab CI artifacts:

| Platform | File |
|----------|------|
| Linux | `Aiyedun_1.0.0_amd64.AppImage` |
| Linux (deb) | `aiyedun-desktop_1.0.0_amd64.deb` |
| Windows | `AiyedunSetup_1.0.0_x64.exe` |
| macOS | `Aiyedun_1.0.0_x64.dmg` |

### Linux (AppImage)
```bash
chmod +x Aiyedun_1.0.0_amd64.AppImage
./Aiyedun_1.0.0_amd64.AppImage
```

### Linux (deb)
```bash
sudo dpkg -i aiyedun-desktop_1.0.0_amd64.deb
```

## First Launch

1. Install and open Aiyedun
2. The app starts minimised to the system tray
3. Click the tray icon (or press **Ctrl+Shift+A**) to open the window
4. Enter your company server URL (default: `https://api.aiyedun.online`)
5. Sign in with your company AD/LDAP credentials
6. Start chatting!

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+A` (Windows/Linux) / `Cmd+Shift+A` (macOS) | Toggle window |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |

## Features

- Chat with Aiyedun AI from your desktop
- Runs in system tray — always accessible
- Upload files directly from your PC (paperclip button)
- Streaming responses via WebSocket
- Source citations with department badge and relevance score
- Conversation history panel with search
- Settings: account info, server URL, autostart, theme, notifications
- OS native notifications when window is hidden
- Starts automatically with your computer (configurable)
- Encrypted token storage via Tauri store plugin

## Development

```bash
# Prerequisites: Rust 1.76+, Node.js 20+, webkit2gtk-4.1 (Linux)

cd desktop
npm install

# Dev mode (hot reload)
npm run dev

# Production build
npm run build

# Debug build
npm run build:debug
```

### Linux build dependencies
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libssl-dev squashfs-tools
```

## Building

```bash
./build-all.sh
# Artifacts: desktop/src-tauri/target/release/bundle/
```

## Project Structure

```
desktop/
  src/
    api/client.ts          # axios API client + WebSocket stream
    store/authStore.ts     # Zustand auth state
    pages/
      LoginPage.tsx        # Compact login (deep blue gradient)
      ChatPage.tsx         # Main chat (file upload, copy, suggested chips)
      HistoryPanel.tsx     # Conversation history with search
      SettingsPanel.tsx    # Settings (account/server/prefs/about)
    components/
      SourceCitation.tsx   # Inline source chips with dept badge + tooltip
      NotificationManager.tsx  # OS notification bridge
    styles/theme.css       # CSS custom properties
  src-tauri/
    src/
      lib.rs              # Tauri setup: tray, global shortcut Ctrl+Shift+A
      commands.rs         # Rust commands: token/URL store, notifications
    tauri.conf.json       # App config (420x680, starts hidden, identifier)
    Cargo.toml            # Rust dependencies
```
