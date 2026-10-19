# R3PLAYX 3.0 development migration

## Scope of 3.0.0-dev.1

Keep the existing React interface and web/Electron builds. The experimental
Windows desktop uses Tauri 2 and Rust for its native runtime, backend lifecycle
and HTTP boundary. Ship the pinned NetEase Node compatibility service with the
installer so users do not need Node.js or a separate API terminal.

This is an incremental migration, not a complete Rust implementation of the
NetEase API. The compatibility service remains Node.js until its endpoints can
be replaced with verified Rust implementations.

Source baseline: `Lynx-1ST/R3PLAY`, branch `dev`, commit
`73d6c7879c8aec7408203d60402e1ce207cc60c7`. The local workspace was empty and
was populated from that commit's GitHub source archive without altering Git
history or creating a branch.

## Implementation and acceptance

1. Package the existing pinned NetEase API with a Node runtime. Bind an ephemeral
   loopback port, authenticate every request with a fresh per-process token,
   and terminate when the parent closes its input pipe.
   Verify actual loopback readiness, denied unauthenticated access, API request
   forwarding and parent shutdown with Node tests.
2. Manage the compatibility process in Rust. Wait for a bounded readiness
   handshake, restrict renderer URLs to that process, disable redirects/proxies,
   limit payload sizes, and terminate/reap the child on shutdown. Recover a dead
   service on the next request. Verify URL validation and lifecycle failures.
3. Version the Tauri package and UI as `3.0.0-dev.1`, bundle backend resources,
   and update Windows CI plus preview documentation. Keep the Electron source
   version and separate application profile.
   Verify frontend types/bridge tests, Rust format/tests and a Windows build.

## Later milestones

- Move cache indexing, metadata and bounded streaming/download jobs into Rust;
  preserve quality variants, range responses and account permissions.
- Add native tray/media keys, miniplayer and device selection individually.
- Replace NetEase compatibility endpoints in feature groups, retaining tests for
  login/logout, cookies, QR, search, playlists, quality and playback.
- Import existing data only through an explicit, backed-up migration.

## Performance acceptance

Compare Electron and Tauri on the same machine with identical account, queue,
quality and animations. Include the entire process tree: WebView2 and the Node
compatibility service. Measure cold startup, idle and playback RAM/CPU, seek,
lyrics and audio dropouts; repeat each scenario three times. No percentage
improvement is claimed before these measurements.

## Local verification status

- Passed: frontend TypeScript check, six Axios/Tauri bridge tests, Tauri frontend
  release build, Rust formatting and locked Cargo manifest resolution.
- Passed: Windows backend resource preparation and authenticated loopback smoke
  test using the bundled Node executable and pinned NetEase runtime. Five
  backend tests pass, covering authentication, JSON/cookies, size limits,
  startup failures and bounded shutdown with a hanging request.
- Native `cargo check --locked` is blocked by missing MSVC `link.exe` and Windows
  SDK on this workstation. The Rust lifecycle tests are implemented but have
  not run locally; Windows CI includes them and the NSIS installer build.
- QR/login, WebView2 playback, installer installation and RAM/CPU comparison
  remain unverified. No release has been published from this local workspace.
