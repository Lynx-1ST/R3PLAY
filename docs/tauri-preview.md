# R3PLAYX 3.0.0-dev.1 — Tauri / Rust Windows preview

This development channel embeds the existing React UI in WebView2, with a Rust
native runtime and supervised backend. Electron, web/PWA and Docker remain
available. The preview does not ship Chromium or start Electron.

## Run on Windows

Install Node.js >=22.12, pnpm 8.6.12, stable Rust (MSVC), Visual Studio C++
Build Tools and WebView2. From the repository root:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
# One terminal: prepare bundled backend, start Vite and the native desktop
pnpm tauri:dev
```

Use the pinned pnpm 8.6.12; `npx pnpm@8.6.12` can be used when another pnpm
version is installed globally. Before dev/build, the preparation script installs
the locked production-only compatibility service and copies the build machine's
Node executable plus its license into ignored backend resources. Development
and packaging currently target Windows x64.

Rust starts the bundled service on first API use and waits up to 20 seconds for
readiness. Each process binds an ephemeral `127.0.0.1` port and requires a fresh
private token. It does not share Electron's port 30001. Closing the desktop
closes the helper's parent pipe; Rust also terminates and reaps the child. A dead
service is restarted on the next API request. Failed startup returns an error;
retry the action or restart the preview. It never retries a possibly completed
API operation automatically.

The compatibility service initializes NetEase guest/key configuration lazily
before real API traffic, with bounded bootstrap requests and retry backoff when
offline. Its health check works without contacting NetEase. Successful
preparation is fingerprinted so repeated dev/build runs reuse the locked bundle.

## Build

```powershell
pnpm tauri:build
```

The NSIS installer is under packages/tauri/src-tauri/target/release/bundle/nsis.
The Tauri Windows Preview workflow builds an unsigned installer as an Actions
artifact, without publishing a release or replacing the Electron installer.
The installer includes the compatibility backend and Node runtime; end users do
not need Node.js, pnpm or a separate API terminal. The NetEase API logic is still
Node.js, not rewritten in Rust. WebView2 remains a Windows prerequisite (the
installer can bootstrap it).

If native build reports `link.exe not found`, install the Visual Studio C++
Build Tools workload and Windows SDK; Visual Studio with only .NET components
is insufficient. See the [official prerequisites](https://v2.tauri.app/start/prerequisites/).

## Implemented

- Existing React routes, player, themes and local settings in a native window.
- Rust manages a bundled NetEase compatibility process with a bounded readiness
  handshake, per-process authentication and shutdown/crash recovery.
- Rust HTTP command is restricted to that process's loopback origin, with
  redirects and system HTTP proxies disabled, bounded paths/cookies, 1 MiB JSON
  requests and 16 MiB responses. No renderer shell or filesystem API.
- Axios bridge preserving query encoding, JSON bodies, cookies, HTTP errors,
  request timeouts and cancellation. Cancellation stops frontend observation;
  an in-flight Rust request can continue until its bounded timeout.
- Dedicated Vite output and disabled PWA registration in Tauri builds.
- Tauri release assets omit bundle-analysis reports and JavaScript source maps;
  debug builds retain maps when `TAURI_ENV_DEBUG=true`.
- Separate bundle identifier and WebView profile. Existing Electron login,
  playlists, settings and cache are not imported or modified.

## Limits and next steps

This is a development preview, not feature parity. Validate QR
and phone login, logout and restart, search, normal/lossless playback, seek,
lyrics and output selection on WebView2 before relying on it. Direct audio
URLs still use the web player and remain subject to source CORS/codec rules.
Apple Music, Unblock/YouTube fallbacks, Electron cache/download/SQLite APIs,
Last.fm, Discord, tray/global shortcuts, miniplayer and automatic updates are
not migrated. Electron-only controls remain guarded by the existing IPC checks.
Cookie persistence and session behavior on WebView2 need manual acceptance tests.

Next: migrate cache and downloads into Rust, then implement desktop IPC
capabilities individually. The [3.0 migration plan](rust-3.0-dev.md) records
the implementation scope and acceptance criteria.
Do not emulate Electron IPC with no-op handlers.

## Verification

```powershell
pnpm --filter tauri-desktop prepare:backend
pnpm --filter tauri-desktop test:backend
pnpm --filter web test:types
pnpm --filter web exec vitest run test/utils/tauriApiAdapter.test.ts
pnpm --filter web build:tauri
cargo fmt --manifest-path packages/tauri/src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path packages/tauri/src-tauri/Cargo.toml
pnpm tauri:build
```

The Tauri Windows Preview workflow runs these checks and builds the unsigned
installer. Source implementation alone is not proof of successful native build
or manual QR/login/playback acceptance. Performance must be measured separately.

## Performance acceptance

Use the same Windows machine, account, queue, quality and effects for both apps.
Record cold-start time to usable UI and total process-tree RAM/CPU (including
WebView2 and the Node API helper) after 60 seconds idle, playback, lyrics and
background animation. Repeat each scenario three times. Record crashes, audio
dropouts and login failures alongside the numbers. No RAM/CPU improvement is
claimed until measured; excluding the API helper would give a misleading result.
