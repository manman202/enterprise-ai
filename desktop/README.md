# Aiyedun Desktop Agent

> Lightweight AI assistant for your desktop — access your company knowledge base without opening a browser.

## Download & Install

### Option 1 — Download from GitLab CI (Recommended)

**Step 1 — Go to the GitLab pipeline:**
https://gitlab.aiyedun.online/root/enterprise-ai/-/pipelines

**Step 2 — Click the latest successful pipeline** (green checkmark ✓)

**Step 3 — Click "build:desktop" job**

**Step 4 — Click "Browse" or "Download artifacts" on the right side**

**Step 5 — Download your platform installer:**
- Windows → `bundle/msi/AiyedunSetup_1.0.0_x64.msi` or `bundle/nsis/AiyedunSetup_1.0.0_x64.exe`
- macOS → `bundle/dmg/Aiyedun_1.0.0_x64.dmg`
- Linux → `bundle/appimage/aiyedun_1.0.0_amd64.AppImage`

### Option 2 — Direct artifact download via API

Replace `YOUR_TOKEN` with your GitLab personal access token:

**Get latest pipeline ID:**
```bash
curl -s --header "PRIVATE-TOKEN: YOUR_TOKEN" \
  "https://gitlab.aiyedun.online/api/v4/projects/1/pipelines/latest" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"
```

**Download Windows installer:**
```bash
curl -L --header "PRIVATE-TOKEN: YOUR_TOKEN" \
  "https://gitlab.aiyedun.online/api/v4/projects/1/jobs/artifacts/main/download?job=build:desktop" \
  -o aiyedun-desktop.zip
unzip aiyedun-desktop.zip
# Installer is in: bundle/nsis/AiyedunSetup_1.0.0_x64.exe
```

---

## Installation Instructions

### Windows
1. Download `AiyedunSetup_1.0.0_x64.exe`
2. Double-click to run the installer
3. If Windows SmartScreen appears → click "More info" → "Run anyway"
4. Follow the setup wizard
5. Aiyedun appears in your system tray (bottom-right corner)

### macOS
1. Download `Aiyedun_1.0.0_x64.dmg`
2. Open the DMG file
3. Drag Aiyedun to your Applications folder
4. First launch: right-click → Open (to bypass Gatekeeper on first run)
5. Aiyedun appears in your menu bar (top-right)

### Linux
1. Download `aiyedun_1.0.0_amd64.AppImage`
2. Make executable:
```bash
chmod +x aiyedun_1.0.0_amd64.AppImage
./aiyedun_1.0.0_amd64.AppImage
```
3. Optional — install system-wide:
```bash
sudo mv aiyedun_1.0.0_amd64.AppImage /usr/local/bin/aiyedun
```

---

## First Launch

1. Aiyedun starts minimized in the system tray
2. Click the tray icon OR press `Ctrl+Shift+A` (Windows/Linux) / `Cmd+Shift+A` (macOS)
3. Enter your server URL: `https://api.aiyedun.online`
4. Login with your company username and password
5. Start chatting!

---

## Build from Source

### Prerequisites
- Node.js 20+
- Rust (latest stable)
- Platform build tools:
  - Windows: Microsoft C++ Build Tools or Visual Studio
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Linux: `sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Build steps
```bash
# Clone the repo
git clone https://gitlab.aiyedun.online/root/enterprise-ai.git
cd enterprise-ai/desktop

# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Build installer for your platform
npm run build

# Output locations:
# Windows:  src-tauri/target/release/bundle/nsis/*.exe
#           src-tauri/target/release/bundle/msi/*.msi
# macOS:    src-tauri/target/release/bundle/dmg/*.dmg
#           src-tauri/target/release/bundle/macos/*.app
# Linux:    src-tauri/target/release/bundle/appimage/*.AppImage
#           src-tauri/target/release/bundle/deb/*.deb
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+A` / `Cmd+Shift+A` | Toggle Aiyedun window |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Esc` | Hide window |

---

## Troubleshooting

**Window does not open:**
- Check system tray — click the Aiyedun icon
- Try the keyboard shortcut Ctrl+Shift+A

**Cannot connect to server:**
- Verify server URL in Settings (gear icon)
- Check you are on the company network or VPN
- Default URL: https://api.aiyedun.online

**Login fails:**
- Use your company AD/LDAP username (not email)
- Contact your IT admin if credentials are rejected

**Windows SmartScreen blocks install:**
- Click "More info" → "Run anyway"
- The app is not yet code-signed (planned for v1.1)

**macOS "App can't be opened":**
- Right-click the app → Open → Open
- Or: System Preferences → Security → "Open Anyway"

---

## Features

- 💬 Chat with Aiyedun AI directly from your desktop
- 🔔 Desktop notifications when responses arrive
- 📁 Upload files from your PC to the knowledge base
- 🔑 Secure token storage (encrypted, never leaves your device)
- ⚡ Global keyboard shortcut — access from anywhere
- 🚀 Auto-starts with your computer (configurable)
- 🌙 Light / Dark / System theme
- 📜 Full conversation history

---

## Version History

| Version | Date | Notes |
|---|---|---|
| 1.0.0 | 2026-03-09 | Initial release |

---

*Aiyedun Desktop is built with [Tauri](https://tauri.app) — secure, lightweight, cross-platform.*
