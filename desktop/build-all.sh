#!/usr/bin/env bash
# Build Aiyedun Desktop for Linux (AppImage + deb)
# Requires: Rust, Node 20+, webkit2gtk-4.1 dev headers
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Installing npm deps…"
npm install

echo "==> Building Tauri app (AppImage + deb)…"
npm run tauri build -- --bundles appimage,deb

echo "==> Build complete. Artifacts:"
find src-tauri/target/release/bundle -type f \( -name "*.AppImage" -o -name "*.deb" \) | sort
