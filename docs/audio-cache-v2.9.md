# Audio cache streaming proposal for v2.9

Status: proposed; the v2.8.9 upload/cache implementation is retained.

The renderer downloads the entire remote response in `packages/web/api/r3play.ts`,
wraps it in a Blob/FormData upload, and the desktop Fastify audio route calls
`data.toBuffer()` before `cache.setAudio()` parses metadata and writes the file.
These steps can retain several copies of a Lossless/Hi-Res track in memory. Playback
already starts independently, and cache failures are caught in `player._cacheAudio()`.

Moving the download crosses a new trust boundary: a privileged backend would fetch
URLs supplied by the renderer. It also needs to reproduce source-specific request
headers and handle expiring URLs, redirects, partial responses, concurrent writes,
and existing quality variants. Changing all these paths during the stability pass
would risk playback and cache correctness. Keep the current behavior for v2.8.x and
implement the following as a separately tested v2.9 change.

1. Send a cache request containing the track ID, resolved URL and quality metadata
   through a trusted renderer IPC handler or the protected local backend. Validate
   a positive safe integer ID and explicit quality/source values. Treat reported
   quality as a hint; preserve actual format, bitrate, sample rate and bit depth.
2. Start a bounded background job. Deduplicate jobs for the same variant; limit
   concurrency, bytes, duration and redirects. Playback never awaits the job.
   Validate each redirect against the source's approved CDN hosts, reject private
   and loopback destinations, and generate source headers in the backend. Use the
   existing CDN policy as an input, but audit it for privileged fetching/SSRF.
3. Stream the full response to a unique temporary file inside `audio_cache` using
   `pipeline()` and calculate SHA-256 incrementally. Reject incomplete 206 responses
   and truncated downloads; never turn a partial song into a playable cache entry.
4. Read metadata from disk with `music-metadata.parseFile()` instead of rebuilding
   an ArrayBuffer/Buffer. Use `getCacheLevel()` with actual codec/bitrate and preserve
   source, format, sample rate and bit depth. Keep Lossless/Hi-Res and effects variants
   separate; never overwrite a higher-quality entry with an inferred lower quality.
5. Atomically rename on the same filesystem and then upsert the existing
   `AudioVariant` key. Handle Windows destination collisions and concurrent jobs.
   Keep the previous entry until the new file and DB row are durable. On a DB
   failure, remove only newly created, unreferenced files; clean abandoned temp
   files after cancellation or crashes.
6. Reuse `resolveCacheAudioPath()` and `streamCachedAudio()` for playback. Preserve
   full, byte-range, suffix-range and HEAD responses, metadata and variant selection.

Before rollout, test slow/truncated/oversized responses, redirects and private-host
rejection, expired source URLs, source headers, cancellation, concurrent jobs,
Windows rename behavior, metadata failures, DB failures and restart recovery.
Compare peak memory on large FLAC fixtures, and verify playback and seeking continue
when every cache failure path is exercised. Keep the old upload path available
until this replacement has equivalent integration and packaged playback coverage.
