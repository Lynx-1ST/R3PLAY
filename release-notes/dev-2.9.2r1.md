# dev-2.9.2r1 — Audio Cache Streaming v2

The renderer now submits a small background IPC request instead of downloading and
uploading the entire audio buffer. Electron streams to a temp file, hashes incrementally,
reads metadata from disk and atomically commits an AudioVariant.

- Two simultaneous jobs, queue capped at 32; 512 MiB/file, five-minute job deadline.
- Header/idle timeouts, five-redirect limit, CDN allowlist and DNS pinning/private-IP rejection.
- Per-variant deduplication, cancellation, failure cleanup and crash recovery.
- Lossless/Hi-Res/effects stay separate; unsupported quality is rejected without downgrade.
- Preserves sample rate, bit depth, full SHA-256 and cached byte-range/HEAD playback.
- Playback and seeking continue during cache failure or an unfinished cache job.
- Also fixes standalone Unblock cache contracts, empty server bulk queries and menu trigger identity.

Synthetic 128 MiB FLAC-header benchmark on Windows/Node 24.21: incremental peak RSS
519 MiB for simulated full-buffer copies vs 58 MiB for streaming plus disk metadata.
These are synthetic measurements, not a production memory guarantee.

Development prerelease, unsigned Windows installer. Stable remains v2.9.1.
Unsupported provider CDNs/proxies skip caching while normal playback continues.
Back up the profile before upgrading. Returning to v2.9.1 requires restoring the backup
or resetting only the AudioVariant cache table; see the design document's rollback steps.
