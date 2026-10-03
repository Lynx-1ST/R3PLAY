<div align="center">

# R3PLAYX

A polished third-party NetEase Cloud Music player for desktop and web.

[English](README.md) · [Tiếng Việt](README.vi.md) · [简体中文](README.zh-CN.md)

[![Build](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/build-dev.yml/badge.svg?branch=dev)](https://github.com/Lynx-1ST/R3PLAY/actions/workflows/build-dev.yml)
![Version](https://img.shields.io/badge/version-2.9.0-2ea44f)
![License](https://img.shields.io/github/license/Lynx-1ST/R3PLAY)

</div>

> [!NOTE]
> R3PLAYX is under active development. This repository is a fork of [Sherlockouo/music](https://github.com/Sherlockouo/music), which itself is based on the YesPlayMusic ecosystem.

## Features

- NetEase Cloud Music login, including QR-code login
- Album, artist, playlist, search, private FM and MV playback
- Synchronized lyrics inside the player
- Restore the listening queue, position, volume, shuffle and repeat settings; startup stays paused
- Live song suggestions in quick search, plus accent-insensitive playlist filtering
- Reorder the listening queue by dragging or using the keyboard
- Optional Discord Rich Presence with track, artist, artwork and playback time
- Audio output selection in Settings and a compact miniplayer
- Configurable themes, accent colors and background artwork
- English, Vietnamese and Simplified Chinese interface
- Multiple audio-source fallbacks through UnblockNeteaseMusic
- NetEase playback quality selection: 128K, 192K, 320K, Lossless and Hi-Res
- Spatial Audio, Audio Vivid and Surround Audio selection on the miniplayer
- Eight download quality levels with per-track and account availability checks
- Audio caching with quality-aware cache reuse
- Optional YouTube fallback on desktop
- Apple Music metadata integration
- Desktop media controls, tray controls and keyboard shortcuts
- Web/PWA support
- Docker deployment
- Windows, macOS and Linux desktop packaging

## Download and new settings

Download the Windows installer from [GitHub Releases](https://github.com/Lynx-1ST/R3PLAY/releases/latest). The desktop updater also uses this repository's releases.

- **Settings → General:** live song suggestions while typing. Enter opens all search results; arrow keys select a suggestion and Enter plays it.
- **Settings → Player:** listening-session restoration (enabled by default), audio output device and Discord Rich Presence (disabled by default). Discord must be running on the same computer.
- Drag a queue item's handle to move it, or focus the handle and press Up/Down. Playlist search matches titles, artists and albums without requiring accents.

Desktop lyrics have been removed. Synchronized lyrics remain available inside the app.

## Screenshots

### Home

<img width="1548" alt="R3PLAYX home" src="https://github.com/Sherlockouo/music/assets/34598208/a58b5c05-ce35-4f32-8b07-fb94df94fc62">

### Discover

<img width="1548" alt="R3PLAYX discover" src="https://github.com/Sherlockouo/music/assets/34598208/4f8c3168-ac8a-476a-8db2-2aede6e85534">

### Lyrics

![Lyrics](https://github.com/Sherlockouo/music/assets/34598208/82123958-db58-4026-ab4d-19f7c8e26495)

## Tech stack

| Area              | Main technologies                            |
| ----------------- | -------------------------------------------- |
| Web UI            | React 19, Vite 7, TypeScript, Tailwind CSS 4 |
| State/data        | Valtio, TanStack Query                       |
| Audio             | Howler.js, hls.js                            |
| Desktop           | Electron 43                                  |
| Desktop local API | Fastify 5, better-sqlite3                    |
| Standalone server | Fastify 5, Prisma 6, SQLite                  |
| Build             | pnpm workspaces, Turborepo                   |
| Packaging         | electron-builder, Docker                     |

## Repository structure

```text
packages/
├── desktop/   # Electron main process, local Fastify server, IPC, cache
├── server/    # Standalone Fastify API server + Prisma/SQLite
├── shared/    # Shared TypeScript types and IPC contracts
└── web/       # React UI used by both the web and Electron builds
```

The Electron application serves the React UI through a local Fastify server. The web build can run separately and communicate with the standalone backend/API services.

## Requirements

- Node.js **22.12 or newer**
- pnpm **8.6.12**
- Git

## Development setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/Lynx-1ST/R3PLAY.git
cd R3PLAY
cp .env.example .env
corepack enable
pnpm install
```

### Run the desktop app

```bash
pnpm dev
```

The root development command starts the workspace tasks needed by the Electron application.

### Run the web app

For web-only development, start the NetEase API helper and Vite in separate terminals:

```bash
pnpm --filter web api:netease
```

```bash
pnpm --filter web dev
```

### Run the standalone server

```bash
pnpm --filter server dev
```

The standalone server listens on port `35530` by default.

## Build and package

Build all packages:

```bash
pnpm build
```

Build only the web application:

```bash
pnpm build:web
```

Package the Electron application:

```bash
pnpm package
```

## Docker

Build and start the web frontend and backend:

```bash
docker compose up --build
```

The frontend is exposed at:

```text
http://localhost:2222
```

The backend remains inside the Compose network and stores its SQLite database in the `server-data` volume.

## Environment variables

The root `.env.example` currently defines:

| Variable                        | Default               | Purpose                                              |
| ------------------------------- | --------------------- | ---------------------------------------------------- |
| `ELECTRON_WEB_SERVER_PORT`      | `42710`               | Electron/Vite web server                             |
| `ELECTRON_DEV_NETEASE_API_PORT` | `30001`               | NetEase API service used during Electron development |
| `VITE_APP_NETEASE_API_URL`      | `/netease`            | Frontend API base path                               |
| `DATABASE_URL`                  | `file:./musicInfo.db` | SQLite database URL                                  |

Docker deployments may also use `APPLE_MUSIC_TOKEN`.

## Playback quality

This fork adds a persistent NetEase playback-quality setting:

| Setting    | Display  |
| ---------- | -------- |
| `standard` | 128K     |
| `higher`   | 192K     |
| `exhigh`   | 320K     |
| `lossless` | Lossless |
| `hires`    | Hi-Res   |

The desktop cache stores separate audio variants per track, including the actual NetEase quality, format, bitrate, sample rate and bit depth. Lossless and Hi-Res are reused only when the saved quality matches the request. Legacy FLAC files without quality metadata remain unknown and are not promoted to either tier. Cached playback streams the requested byte range instead of loading the full file into memory.

## Audio modes and downloads

Use the audio mode icon on the miniplayer to select **Off**, **Spatial Audio**, **Audio Vivid**, or **Surround Audio**. Mode changes apply to the current track while preserving playback position and the playing/paused state. The menu stays within the viewport when the miniplayer is collapsed.

Enable download actions in Settings, then click a track's download button to select its quality:

| Download quality | API level |
| --- | --- |
| Spatial Audio | `jyeffect` |
| Audio Vivid | `vivid` |
| Surround Audio | `sky` |
| Master | `jymaster` |
| Hi-Res | `hires` |
| Lossless | `lossless` |
| HQ · 320 kbps | `exhigh` |
| Standard · 128 kbps | `standard` |

Availability is checked for the current track and NetEase account. Unsupported or unverified options appear dimmed; clicking them displays a notification. Download access is checked separately using the download API and checked again before downloading. If the selected quality is unavailable, the app does not silently download a lower-quality file, a preview, or an alternative source. The file keeps the format returned by the API.

Availability depends on account permissions, the audio versions offered for each track, and the output device. Not every track offers every quality level. Spatial Audio, Audio Vivid, Surround Audio, and Lossless retain their names in the Vietnamese interface.

**v2.8.9** also fixes duplicate download API registration that prevented the previous test installer from starting. See the [English changelog](https://github.com/Lynx-1ST/R3PLAY/releases/tag/v2.8.9) for all changes. Install over your existing version without uninstalling or deleting application data. If the old build is still running in the background, end R3PLAYX in Task Manager before installing.

## Useful commands

```bash
pnpm lint
pnpm format
pnpm --filter web test
pnpm --filter web test:types
pnpm --filter desktop test
pnpm --filter desktop test:types
pnpm --filter desktop test:cache
```

## Upstream projects

R3PLAYX builds on work from several open-source projects, including:

- [Sherlockouo/music](https://github.com/Sherlockouo/music)
- [YesPlayMusic](https://github.com/qier222/YesPlayMusic)
- [NeteaseCloudMusicApi Enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced)
- [UnblockNeteaseMusic](https://github.com/UnblockNeteaseMusic/server)

The original UI design credits [JACKCRING](https://jackcring.com).

## License and disclaimer

This repository is distributed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** as declared by the repository `LICENSE` file.

This project is an unofficial client and is not affiliated with NetEase, Apple, YouTube, or other referenced service providers. Use it responsibly and comply with the terms of the services and the laws applicable in your jurisdiction.

The upstream README also contains additional usage/disclaimer language. Review upstream notices before redistribution or deployment.

## Development resources

- [Upstream developer wiki](https://github.com/Sherlockouo/music/wiki/For-Developers)
- [Upstream repository](https://github.com/Sherlockouo/music)
- [Upstream web demo](https://music.xtify.top/)
