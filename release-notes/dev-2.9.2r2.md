# dev-2.9.2r2 — Audio cache reliability fixes

This development prerelease improves Audio Cache Streaming v2 from dev-2.9.2r1.

- Desktop and standalone server share a 120-second Unblock URL cache TTL and URL validation.
- Startup cleanup continues past locked orphan files; failed initialization can retry.
- Desktop/server bulk DB writes name columns, preserving defaults after schema changes.
- Playback tries an exact NetEase cache, then NetEase, then cached fallback before Unblock.
  Fallback audio retains unknown quality rather than claiming the requested NetEase tier.
- Adds My Music login/loading/error/retry/empty/favorites component regression tests.
- Adds opt-in live CDN verification through the production streaming downloader and cached Range reads.

Validation: 708 Vitest tests and six audio-cache tests passed locally; all three package
typechecks and Electron main build passed. Existing lint errors remain unchanged.
The Windows publishing pipeline performs full build, packaging and packaged smoke tests.

Live Kuwo transfer/cache/Range verification passed with a small MP3 response. This does
not prove full-song playback or production hit rate. NetEase 320K, Lossless, Hi-Res,
AAC and audio-effect real-CDN cases remain unverified because the test environment did
not return authorized full URLs at the requested quality. Further testing is required
before stable; caching failure never interrupts playback.

Development prerelease with an unsigned Windows installer. Back up the profile before
upgrading. Downgrading to v2.9.1 requires restoring that backup or, with the app stopped,
resetting only the AudioVariant cache table. The old binary cannot handle the new hash
column and streaming filenames. Retain account, playlist and settings tables. See
docs/audio-cache-v2.9.md for rollback steps.
