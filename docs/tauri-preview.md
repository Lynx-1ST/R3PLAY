# Tauri / Rust Windows proof of concept

This is the first migration milestone, version 0.1.0. Electron, web/PWA and
Docker remain available. The preview embeds the existing React UI in WebView2
with native window controls. It does not ship Chromium or start Electron.

## Run on Windows

Install Node.js >=22.12, pnpm 8.6.12, stable Rust (MSVC), Visual Studio C++
Build Tools and WebView2. From the repository root:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
# Terminal 1: explicit development backend (requires Node.js)
pnpm tauri:api
# Terminal 2: native desktop + Vite
pnpm tauri:dev
```

Do not run the Electron API server on port 30001 at the same time.
The helper binds only to 127.0.0.1:30001 and reuses the repository's pinned
enhanced NetEase API dependency. It is a separate, manually started process;
closing the preview does not close this terminal's helper.

## Build

```powershell
pnpm tauri:build
```

The NSIS installer is under packages/tauri/src-tauri/target/release/bundle/nsis.
The Tauri Windows Preview workflow builds an unsigned installer as an Actions
artifact, without publishing a release or replacing the Electron installer.
The installer still requires the separately running API helper for network
features; this milestone is not a standalone end-user distribution.

## Implemented

- Existing React routes, player, themes and local settings in a native window.
- Rust HTTP command to the fixed loopback NetEase backend, with redirects and
  system HTTP proxies disabled. No arbitrary-host HTTP, shell or filesystem API.
- Axios bridge preserving query encoding, JSON bodies, cookies, HTTP errors,
  request timeouts and cancellation. Cancellation stops frontend observation;
  an in-flight Rust request can continue until its bounded timeout.
- Dedicated Vite output and disabled PWA registration in Tauri builds.
- Separate bundle identifier and WebView profile. Existing Electron login,
  playlists, settings and cache are not imported or modified.

## Limits and next steps

This is a runtime/API bridge proof of concept, not feature parity. Validate QR
and phone login, logout and restart, search, normal/lossless playback, seek,
lyrics and output selection on WebView2 before relying on it. Direct audio
URLs still use the web player and remain subject to source CORS/codec rules.
Apple Music, Unblock/YouTube fallbacks, Electron cache/download/SQLite APIs,
Last.fm, Discord, tray/global shortcuts, miniplayer and automatic updates are
not migrated. Electron-only controls remain guarded by the existing IPC checks.
Cookie persistence and session behavior on WebView2 need manual acceptance tests.

Next: bundle and supervise a constrained backend sidecar, migrate cache and
downloads into Rust, then implement desktop IPC capabilities individually.
Do not emulate Electron IPC with no-op handlers.

## Performance acceptance

Use the same Windows machine, account, queue, quality and effects for both apps.
Record cold-start time to usable UI and total process-tree RAM/CPU (including
WebView2 and the Node API helper) after 60 seconds idle, playback, lyrics and
background animation. Repeat each scenario three times. Record crashes, audio
dropouts and login failures alongside the numbers. No RAM/CPU improvement is
claimed until measured; excluding the API helper would give a misleading result.
