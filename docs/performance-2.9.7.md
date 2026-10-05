# Resource optimizations in 2.9.7-dev.3

Preserve playback quality, audio effects, artwork quality and visible animation. Remove idle work and repeated metadata requests instead of lowering quality settings.

## Changes

- Artwork searches use an abortable two-worker queue. Aborting a waiting request removes the job immediately; active HTTP requests receive the same abort signal.
- Artwork keys normalize entity kind, title, artist and album. TanStack Query shares requests for equivalent keys. An asynchronous IndexedDB cache persists positive matches for seven days and misses for one day, with a maximum of 1,000 entries. Storage failure falls back to ordinary searches; upstream/network failures are not cached as misses.
- Last.fm playback samples only run for configured, connected accounts with scrobbling enabled. Send play/pause/track/account transitions immediately and sample every two seconds during playback. Pause and disconnected accounts have no sampling timer. Discord presence also stops its periodic timer while paused.
- Last.fm status uses native change events and focus refreshes. Metadata observers share the status cache and create no periodic status timers. Browser authorization still polls only while an authorization is pending. Native events contain the public status, never application credentials or session keys.
- Account changes abort metadata reads and spacing waits, detach the old queue, reset scheduling and discard late results/errors. Metadata-only invalidation after a love action preserves rate-limit backoff and request spacing.
- Audio effects popover measures its anchor on opening, resize, scrolling and relevant size changes, with one coalesced animation frame per update. It has no continuous idle animation loop.

## Measurements and validation

Chromium production build, 1440×1000, paused restored track, open audio-effects menu, five-second sample:

| Work | Before | After |
| --- | ---: | ---: |
| Popover rectangle reads | 602 | 0 |
| Last.fm playback IPC messages | 5 | 0 |
| Discord playback IPC messages | 1 | 0 |
| Script duration | 7.746 ms | 3.827 ms |

These figures measure this controlled idle scenario, not a percentage reduction of the whole application's CPU or RAM. Existing timers unrelated to the menu remain included in total task time.

Regression checks: 1,000 queued jobs removed before active workers finish; immediate playback transitions and two-second sampling; disconnect/scrobbling-disabled timer shutdown; safe native status notifications; fresh account reads independent of old requests; stale rate-limit response isolation. Browser checks cover actual IndexedDB persistence after reload, positive/negative TTLs, expiration refetch and eviction at the 1,000-entry cap. Audio-effects placement remains within the viewport after resize and Escape closes it.

Validation: 664 desktop tests, 151 renderer tests, both TypeScript checks, production build, Last.fm interaction/responsive browser checks and packaged Electron runtime checks.

References: [TanStack Query v5 cache lifecycle](https://tanstack.com/query/v5/docs/framework/react/guides/caching), [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).
