# Last.fm explorer

## Objective and accepted scope

The user requested both listening statistics and music discovery. Add a dedicated desktop Last.fm page using the existing application credentials and encrypted account session. Keep the app's current typography, accent colors and uncluttered settings.

## User flows

- Overview: profile, lifetime scrobbles, artist/album/track counts, registration date and period-based top tracks/artists/albums (7 days, 1/3/6/12 months, all time).
- History and loved tracks: paginated, retain genuine Now Playing and timestamp values; explicitly love/unlove the authenticated user's tracks.
- Discovery: global charts, tags, and suggestions seeded by the user's top artists/tracks. Artist and track details link to similar music and popular tracks. A currently playing song can be used as a seed.
- Read any public username without requiring a session; write actions always use the authenticated session. Signing in and scrobbling remain available in Settings.
- Play a result by resolving its title and artist to the existing music provider. Reject ambiguous matches and offer normal search; never claim Last.fm supplies audio.

## Interface and boundaries

Typed, allowlisted IPC reads expose normalized metadata only, with bounded inputs, result counts, cache size and concurrency. No arbitrary API method, URL, API key or session key can come from the renderer. Public reads are GET without a signature; writes remain signed POST. Cached reads deduplicate requests and are paced. Account changes invalidate cached private context. API text is rendered as text, never HTML; outgoing URLs/images are restricted to Last.fm's HTTPS hosts.

Love/unlove happens only on an explicit click. Failed writes show an error and preserve the prior UI state. Network, configuration, missing user/resource and authorization errors have distinct recoverable states. Empty lists are not fabricated data. Refresh, pagination and profile/period changes must not reuse the wrong account's results.

## Structure and validation

- `packages/shared/lastfm.ts`: metadata and IPC contracts.
- `packages/desktop/main/utils/lastfmData.ts`: validated read requests, normalized responses and bounded caching.
- `packages/desktop/main/lastfm.ts`: session ownership and authenticated writes.
- `packages/web/pages/LastFm/`: page and presentation components.
- Desktop Vitest tests cover request validation, upstream response shapes, cache deduplication, account changes, signed writes and failure handling.
- Web Vitest tests cover conservative provider matching. Browser/native checks cover navigation, period/profile changes, pagination, discovery drilldown, explicit love/unlove, playback, empty/error states and resizing at 800/1024/1440px.

Commands (from package directories): `node ../../node_modules/vitest/vitest.mjs run`; `node ../../node_modules/typescript/bin/tsc --noEmit`; web build `IS_ELECTRON=1 node ../../node_modules/vite/bin/vite.js build`; desktop build `node ../../node_modules/tsx/dist/cli.mjs scripts/build.main.ts`.

## Sources

[API intro](https://www.last.fm/api/intro), [top tracks and periods](https://www.last.fm/api/show/user.getTopTracks), [recent tracks](https://www.last.fm/api/show/user.getRecentTracks), [track details](https://www.last.fm/api/show/track.getInfo), [similar artists](https://www.last.fm/api/show/artist.getSimilar), [tag tracks](https://www.last.fm/api/show/tag.getTopTracks), [love](https://www.last.fm/api/show/track.love).

Build and verify locally first. No stable release is published as part of this implementation request.
